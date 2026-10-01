from datetime import datetime, timezone
from pathlib import Path

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.db.base import Base
from app.models.question import AnswerChoice, Question
from app.models.quiz import QuizSession, QuizSessionQuestion, QuizStatus
from app.models.topic import Topic
from app.services.quiz_engine import build_results, start_quiz, start_weak_quiz, submit_answer


@pytest.fixture()
def db(tmp_path: Path):
    engine = create_engine(
        f"sqlite:///{tmp_path / 'test.db'}",
        connect_args={"check_same_thread": False},
    )
    Base.metadata.create_all(engine)
    maker = sessionmaker(bind=engine, expire_on_commit=False)
    with maker() as session:
        yield session


def add_question(db: Session, topic: Topic, number: int) -> Question:
    question = Question(
        topic_id=topic.id,
        prompt=f"Question {number}",
        prompt_alternatives=[f"Alternative question {number}"],
    )
    db.add(question)
    db.flush()
    db.add_all(
        [
            AnswerChoice(question_id=question.id, text=f"Correct {number}", alternatives=[f"Right {number}"], is_correct=True),
            AnswerChoice(question_id=question.id, text=f"Wrong A {number}", alternatives=[], is_correct=False),
            AnswerChoice(question_id=question.id, text=f"Wrong B {number}", alternatives=[f"Distractor {number}"], is_correct=False),
        ]
    )
    return question


def test_quiz_caps_at_100_and_has_unique_questions(db: Session):
    topic = Topic(name="Module 1", mistake_limit=5, max_questions=100)
    db.add(topic)
    db.flush()
    for number in range(1, 121):
        add_question(db, topic, number)
    db.commit()

    session, _ = start_quiz(db, topic.id, 100)

    assert len(session.questions) == 100
    assert len({item.question_id for item in session.questions}) == 100
    assert all(len(item.choice_payload) == 3 for item in session.questions)
    assert all(
        item.prompt_snapshot in {item.question.prompt, *item.question.prompt_alternatives}
        for item in session.questions
    )


def test_session_terminates_at_mistake_limit(db: Session):
    topic = Topic(name="Module 2", mistake_limit=2, max_questions=10)
    db.add(topic)
    db.flush()
    for number in range(1, 6):
        add_question(db, topic, number)
    db.commit()

    session, question = start_quiz(db, topic.id, 5)

    for _ in range(2):
        current = next(item for item in session.questions if item.id == question.session_question_id)
        correct_id = next(choice.id for choice in current.question.choices if choice.is_correct)
        wrong_id = next(item["id"] for item in current.choice_payload if item["id"] != correct_id)
        session, next_question = submit_answer(db, session.id, current.id, wrong_id)
        if next_question is not None:
            question = next_question

    assert session.status.value == "terminated"
    assert session.end_reason == "mistake_limit"
    results = build_results(db, session.id)
    assert results["mistakes"] == 2
    assert results["answered_questions"] == 2



def add_finished_attempt(
    db: Session,
    topic: Topic,
    results: list[tuple[Question, bool]],
    day: int,
) -> None:
    when = datetime(2026, 1, day, 12, 0, tzinfo=timezone.utc)
    session = QuizSession(
        topic_id=topic.id,
        requested_count=len(results),
        mistake_limit=topic.mistake_limit,
        mistake_count=sum(1 for _, correct in results if not correct),
        status=QuizStatus.COMPLETED,
        end_reason="completed",
        started_at=when,
        ended_at=when,
    )
    db.add(session)
    db.flush()

    for position, (question, correct) in enumerate(results, start=1):
        correct_choice = next(choice for choice in question.choices if choice.is_correct)
        selected_choice = correct_choice if correct else next(
            choice for choice in question.choices if not choice.is_correct
        )
        db.add(
            QuizSessionQuestion(
                session_id=session.id,
                question_id=question.id,
                position=position,
                prompt_snapshot=question.prompt,
                choice_payload=[
                    {"id": choice.id, "text": choice.text}
                    for choice in question.choices
                ],
                selected_choice_id=selected_choice.id,
                is_correct=1 if correct else 0,
                answered_at=when,
            )
        )

    db.commit()


def test_weak_quiz_selects_previously_missed_questions_by_priority(db: Session):
    topic = Topic(name="Weak Module", mistake_limit=5, max_questions=10)
    db.add(topic)
    db.flush()
    frequent_miss = add_question(db, topic, 1)
    occasional_miss = add_question(db, topic, 2)
    never_missed = add_question(db, topic, 3)
    db.commit()

    add_finished_attempt(
        db,
        topic,
        [(frequent_miss, False), (occasional_miss, False), (never_missed, True)],
        day=1,
    )
    add_finished_attempt(
        db,
        topic,
        [(frequent_miss, False), (occasional_miss, True), (never_missed, True)],
        day=2,
    )

    session, _ = start_weak_quiz(db, topic.id, 1)

    assert len(session.questions) == 1
    assert session.questions[0].question_id == frequent_miss.id


def test_weak_quiz_caps_at_available_weak_questions(db: Session):
    topic = Topic(name="Weak Module 2", mistake_limit=5, max_questions=10)
    db.add(topic)
    db.flush()
    missed_a = add_question(db, topic, 1)
    missed_b = add_question(db, topic, 2)
    never_missed = add_question(db, topic, 3)
    db.commit()

    add_finished_attempt(
        db,
        topic,
        [(missed_a, False), (missed_b, False), (never_missed, True)],
        day=1,
    )

    session, _ = start_weak_quiz(db, topic.id, 10)

    assert len(session.questions) == 2
    assert {item.question_id for item in session.questions} == {missed_a.id, missed_b.id}


def test_weak_quiz_requires_previously_missed_active_questions(db: Session):
    topic = Topic(name="Weak Module 3", mistake_limit=5, max_questions=10)
    db.add(topic)
    db.flush()
    question = add_question(db, topic, 1)
    db.commit()

    add_finished_attempt(db, topic, [(question, True)], day=1)

    with pytest.raises(Exception) as exc_info:
        start_weak_quiz(db, topic.id, 5)

    assert getattr(exc_info.value, "status_code", None) == 400
    assert "no previously missed active questions" in str(
        getattr(exc_info.value, "detail", "")
    ).lower()
