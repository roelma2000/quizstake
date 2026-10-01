from datetime import datetime, timezone
from pathlib import Path

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.db.base import Base
from app.models.question import Question
from app.models.quiz import QuizSession, QuizSessionQuestion, QuizStatus
from app.models.topic import Topic
from app.services.performance import build_performance_analysis


@pytest.fixture()
def db(tmp_path: Path):
    engine = create_engine(
        f"sqlite:///{tmp_path / 'performance.db'}",
        connect_args={"check_same_thread": False},
    )
    Base.metadata.create_all(engine)
    maker = sessionmaker(bind=engine, expire_on_commit=False)
    with maker() as session:
        yield session


def add_question(db: Session, topic: Topic, prompt: str) -> Question:
    question = Question(topic_id=topic.id, prompt=prompt)
    db.add(question)
    db.flush()
    return question


def add_session(
    db: Session,
    topic: Topic,
    answers: list[tuple[Question, bool | None]],
    *,
    status: QuizStatus = QuizStatus.COMPLETED,
    day: int = 1,
) -> QuizSession:
    when = datetime(2026, 1, day, 12, 0, tzinfo=timezone.utc)
    session = QuizSession(
        topic_id=topic.id,
        requested_count=len(answers),
        mistake_limit=5,
        mistake_count=sum(1 for _, correct in answers if correct is False),
        status=status,
        end_reason="completed" if status == QuizStatus.COMPLETED else None,
        started_at=when,
        ended_at=when if status != QuizStatus.ACTIVE else None,
    )
    db.add(session)
    db.flush()

    for position, (question, correct) in enumerate(answers, start=1):
        answered = correct is not None
        db.add(
            QuizSessionQuestion(
                session_id=session.id,
                question_id=question.id,
                position=position,
                prompt_snapshot=question.prompt,
                choice_payload=[{"id": 1, "text": "A"}],
                selected_choice_id=1 if answered else None,
                is_correct=1 if correct is True else 0 if correct is False else None,
                answered_at=when if answered else None,
            )
        )

    db.commit()
    return session


def test_performance_aggregates_finished_quizzes_and_ignores_unanswered(db: Session):
    topic = Topic(name="Module 1")
    db.add(topic)
    db.flush()
    q1 = add_question(db, topic, "Question 1")
    q2 = add_question(db, topic, "Question 2")

    add_session(db, topic, [(q1, True), (q2, False)], day=1)
    add_session(db, topic, [(q1, False), (q2, None)], day=2)
    add_session(db, topic, [(q1, False)], status=QuizStatus.ACTIVE, day=3)

    result = build_performance_analysis(db)

    assert len(result["topics"]) == 1
    stats = result["topics"][0]
    assert stats["attempts"] == 2
    assert stats["answered_questions"] == 3
    assert stats["correct_answers"] == 1
    assert stats["mistakes"] == 2
    assert stats["accuracy_percent"] == 33.33


def test_weak_questions_are_ranked_by_misses(db: Session):
    topic = Topic(name="Module 1")
    db.add(topic)
    db.flush()
    frequent_miss = add_question(db, topic, "Frequently missed")
    occasional_miss = add_question(db, topic, "Occasionally missed")
    always_correct = add_question(db, topic, "Always correct")

    add_session(
        db,
        topic,
        [(frequent_miss, False), (occasional_miss, False), (always_correct, True)],
        day=1,
    )
    add_session(
        db,
        topic,
        [(frequent_miss, False), (occasional_miss, True), (always_correct, True)],
        day=2,
    )
    add_session(
        db,
        topic,
        [(frequent_miss, True), (occasional_miss, True)],
        day=3,
    )

    result = build_performance_analysis(db)

    assert [item["question_id"] for item in result["weak_questions"]] == [
        frequent_miss.id,
        occasional_miss.id,
    ]
    assert result["weak_questions"][0]["incorrect_answers"] == 2
    assert result["weak_questions"][0]["accuracy_percent"] == 33.33
    assert result["weak_questions"][1]["incorrect_answers"] == 1
    assert result["weak_questions"][1]["accuracy_percent"] == 66.67


def test_performance_can_filter_topic_and_limit_weak_questions(db: Session):
    topic_a = Topic(name="Module 1")
    topic_b = Topic(name="Module 2")
    db.add_all([topic_a, topic_b])
    db.flush()
    a1 = add_question(db, topic_a, "A1")
    a2 = add_question(db, topic_a, "A2")
    b1 = add_question(db, topic_b, "B1")

    add_session(db, topic_a, [(a1, False), (a2, False)], day=1)
    add_session(db, topic_b, [(b1, False)], day=2)

    result = build_performance_analysis(db, topic_id=topic_a.id, weak_limit=1)

    assert len(result["topics"]) == 1
    assert result["topics"][0]["topic_id"] == topic_a.id
    assert len(result["weak_questions"]) == 1
    assert result["weak_questions"][0]["topic_id"] == topic_a.id
