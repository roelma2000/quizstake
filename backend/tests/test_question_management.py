from pathlib import Path

import pytest
from fastapi import HTTPException
from pydantic import ValidationError
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.api.routes.questions import create_question, delete_question, get_question, update_question
from app.db.base import Base
from app.models.question import Question
from app.models.topic import Topic
from app.schemas.question import AnswerChoiceInput, QuestionCreate, QuestionUpdate
from app.services.quiz_engine import start_quiz


@pytest.fixture()
def db(tmp_path: Path):
    engine = create_engine(
        f"sqlite:///{tmp_path / 'question-management.db'}",
        connect_args={"check_same_thread": False},
    )
    Base.metadata.create_all(engine)
    maker = sessionmaker(bind=engine, expire_on_commit=False)
    with maker() as session:
        yield session


@pytest.fixture()
def topic(db: Session) -> Topic:
    item = Topic(name="Module 1")
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


def question_payload(topic_id: int) -> QuestionCreate:
    return QuestionCreate(
        topic_id=topic_id,
        prompt="What does a red traffic light mean?",
        prompt_alternatives=["What action is required at a steady red light?"],
        explanation="A steady red light requires a complete stop.",
        choices=[
            AnswerChoiceInput(
                text="Stop",
                alternatives=["Come to a complete stop"],
                is_correct=True,
            ),
            AnswerChoiceInput(text="Slow down", alternatives=[], is_correct=False),
            AnswerChoiceInput(text="Proceed", alternatives=["Keep going"], is_correct=False),
        ],
    )


def test_question_requires_exactly_one_correct_answer(topic: Topic):
    with pytest.raises(ValidationError):
        QuestionCreate(
            topic_id=topic.id,
            prompt="Invalid question",
            choices=[
                AnswerChoiceInput(text="A", is_correct=True),
                AnswerChoiceInput(text="B", is_correct=True),
                AnswerChoiceInput(text="C", is_correct=False),
            ],
        )


def test_create_and_update_question_preserves_choice_ids(db: Session, topic: Topic):
    created = create_question(question_payload(topic.id), db)
    original_choice_ids = [choice.id for choice in created.choices]

    updated = update_question(
        created.id,
        QuestionUpdate(
            prompt="What must you do at a steady red traffic light?",
            prompt_alternatives=["What is required at a steady red signal?"],
            explanation="Stop before the stop line or crosswalk.",
            choices=[
                AnswerChoiceInput(text="Stop completely", alternatives=["Full stop"], is_correct=True),
                AnswerChoiceInput(text="Accelerate", alternatives=[], is_correct=False),
                AnswerChoiceInput(text="Honk", alternatives=["Sound the horn"], is_correct=False),
            ],
        ),
        db,
    )

    assert updated.prompt == "What must you do at a steady red traffic light?"
    assert updated.prompt_alternatives == ["What is required at a steady red signal?"]
    assert updated.explanation == "Stop before the stop line or crosswalk."
    assert [choice.id for choice in updated.choices] == original_choice_ids
    assert sum(choice.is_correct for choice in updated.choices) == 1
    assert updated.choices[0].text == "Stop completely"


def test_delete_unused_question(db: Session, topic: Topic):
    created = create_question(question_payload(topic.id), db)

    response = delete_question(created.id, db)

    assert response.status_code == 204
    assert db.get(Question, created.id) is None


def test_question_with_quiz_history_cannot_be_deleted(db: Session, topic: Topic):
    created = create_question(question_payload(topic.id), db)
    start_quiz(db, topic.id, 1)

    with pytest.raises(HTTPException) as exc_info:
        delete_question(created.id, db)

    assert exc_info.value.status_code == 409
    assert "deactivate" in exc_info.value.detail.lower()
    assert get_question(created.id, db).active is True
