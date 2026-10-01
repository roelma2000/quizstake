from pathlib import Path

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.db.base import Base
from app.models.question import AnswerChoice, Question
from app.models.topic import Topic
from app.services.quiz_engine import build_results, start_quiz, submit_answer


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
    question = Question(topic_id=topic.id, prompt=f"Question {number}")
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
