from pathlib import Path

import pytest
from fastapi import HTTPException
from pydantic import ValidationError
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.api.routes.topics import create_topic, delete_topic, update_topic
from app.db.base import Base
from app.models.question import AnswerChoice, Question
from app.models.quiz import QuizSession
from app.models.topic import Topic
from app.schemas.topic import TopicCreate, TopicUpdate


@pytest.fixture()
def db(tmp_path: Path):
    engine = create_engine(
        f"sqlite:///{tmp_path / 'topic-management.db'}",
        connect_args={"check_same_thread": False},
    )
    Base.metadata.create_all(engine)
    maker = sessionmaker(bind=engine, expire_on_commit=False)
    with maker() as session:
        yield session


def test_topic_name_is_trimmed_and_duplicate_is_blocked(db: Session):
    created = create_topic(TopicCreate(name="  Module 1  "), db)

    assert created.name == "Module 1"

    with pytest.raises(HTTPException) as exc_info:
        create_topic(TopicCreate(name="module 1"), db)

    assert exc_info.value.status_code == 409


def test_topic_settings_can_be_updated(db: Session):
    created = create_topic(
        TopicCreate(name="Module 1", mistake_limit=5, max_questions=100),
        db,
    )

    updated = update_topic(
        created.id,
        TopicUpdate(
            name="Road Signs",
            description="Traffic sign practice",
            mistake_limit=3,
            max_questions=40,
            active=False,
        ),
        db,
    )

    assert updated.name == "Road Signs"
    assert updated.description == "Traffic sign practice"
    assert updated.mistake_limit == 3
    assert updated.max_questions == 40
    assert updated.active is False


def test_topic_limits_are_validated():
    with pytest.raises(ValidationError):
        TopicCreate(name="Invalid", mistake_limit=0)

    with pytest.raises(ValidationError):
        TopicCreate(name="Invalid", max_questions=101)


def test_empty_topic_can_be_deleted(db: Session):
    created = create_topic(TopicCreate(name="Unused"), db)

    response = delete_topic(created.id, db)

    assert response.status_code == 204
    assert db.get(Topic, created.id) is None


def test_topic_with_questions_cannot_be_deleted(db: Session):
    created = create_topic(TopicCreate(name="Module 1"), db)
    question = Question(topic_id=created.id, prompt="Question 1")
    db.add(question)
    db.flush()
    db.add_all(
        [
            AnswerChoice(question_id=question.id, text="A", is_correct=True),
            AnswerChoice(question_id=question.id, text="B", is_correct=False),
            AnswerChoice(question_id=question.id, text="C", is_correct=False),
        ]
    )
    db.commit()

    with pytest.raises(HTTPException) as exc_info:
        delete_topic(created.id, db)

    assert exc_info.value.status_code == 409
    assert "deactivate" in exc_info.value.detail.lower()


def test_topic_with_quiz_history_cannot_be_deleted(db: Session):
    created = create_topic(TopicCreate(name="Module 1"), db)
    db.add(
        QuizSession(
            topic_id=created.id,
            requested_count=1,
            mistake_limit=5,
        )
    )
    db.commit()

    with pytest.raises(HTTPException) as exc_info:
        delete_topic(created.id, db)

    assert exc_info.value.status_code == 409
