from datetime import datetime, timezone
from pathlib import Path

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.db.base import Base
from app.models.question import Question
from app.models.quiz import QuizSession, QuizSessionQuestion, QuizStatus
from app.models.topic import Topic
from app.services.quiz_engine import list_quiz_history


@pytest.fixture()
def db(tmp_path: Path):
    engine = create_engine(
        f"sqlite:///{tmp_path / 'quiz-history.db'}",
        connect_args={"check_same_thread": False},
    )
    Base.metadata.create_all(engine)
    maker = sessionmaker(bind=engine, expire_on_commit=False)
    with maker() as session:
        yield session


def add_history_session(
    db: Session,
    topic: Topic,
    *,
    status: QuizStatus,
    started_at: datetime,
    answered: list[bool],
    total_questions: int,
) -> QuizSession:
    session = QuizSession(
        topic_id=topic.id,
        requested_count=total_questions,
        mistake_limit=5,
        mistake_count=sum(1 for correct in answered if not correct),
        status=status,
        end_reason="completed" if status == QuizStatus.COMPLETED else "mistake_limit",
        started_at=started_at,
        ended_at=started_at if status != QuizStatus.ACTIVE else None,
    )
    db.add(session)
    db.flush()

    for position in range(1, total_questions + 1):
        question = Question(topic_id=topic.id, prompt=f"Question {topic.id}-{position}")
        db.add(question)
        db.flush()

        was_answered = position <= len(answered)
        is_correct = answered[position - 1] if was_answered else None
        db.add(
            QuizSessionQuestion(
                session_id=session.id,
                question_id=question.id,
                position=position,
                prompt_snapshot=question.prompt,
                choice_payload=[{"id": 1, "text": "A"}],
                selected_choice_id=1 if was_answered else None,
                is_correct=1 if is_correct is True else 0 if is_correct is False else None,
                answered_at=started_at if was_answered else None,
            )
        )

    db.commit()
    return session


def test_history_lists_finished_sessions_newest_first_and_excludes_active(db: Session):
    topic_a = Topic(name="Module 1")
    topic_b = Topic(name="Module 2")
    db.add_all([topic_a, topic_b])
    db.flush()

    older = add_history_session(
        db,
        topic_a,
        status=QuizStatus.COMPLETED,
        started_at=datetime(2026, 1, 1, 12, 0, tzinfo=timezone.utc),
        answered=[True, False],
        total_questions=2,
    )
    newer = add_history_session(
        db,
        topic_b,
        status=QuizStatus.TERMINATED,
        started_at=datetime(2026, 1, 2, 12, 0, tzinfo=timezone.utc),
        answered=[False],
        total_questions=3,
    )
    add_history_session(
        db,
        topic_a,
        status=QuizStatus.ACTIVE,
        started_at=datetime(2026, 1, 3, 12, 0, tzinfo=timezone.utc),
        answered=[],
        total_questions=1,
    )

    history = list_quiz_history(db)

    assert [item["session_id"] for item in history] == [newer.id, older.id]
    assert history[0]["topic_name"] == "Module 2"
    assert history[0]["answered_questions"] == 1
    assert history[0]["correct_answers"] == 0
    assert history[0]["mistakes"] == 1
    assert history[0]["score_percent"] == 0.0
    assert history[1]["score_percent"] == 50.0


def test_history_can_filter_by_topic(db: Session):
    topic_a = Topic(name="Module 1")
    topic_b = Topic(name="Module 2")
    db.add_all([topic_a, topic_b])
    db.flush()

    add_history_session(
        db,
        topic_a,
        status=QuizStatus.COMPLETED,
        started_at=datetime(2026, 1, 1, 12, 0, tzinfo=timezone.utc),
        answered=[True],
        total_questions=1,
    )
    add_history_session(
        db,
        topic_b,
        status=QuizStatus.COMPLETED,
        started_at=datetime(2026, 1, 2, 12, 0, tzinfo=timezone.utc),
        answered=[True],
        total_questions=1,
    )

    history = list_quiz_history(db, topic_id=topic_a.id)

    assert len(history) == 1
    assert history[0]["topic_id"] == topic_a.id
    assert history[0]["topic_name"] == "Module 1"


def test_history_limit_is_applied(db: Session):
    topic = Topic(name="Module 1")
    db.add(topic)
    db.flush()

    for day in range(1, 4):
        add_history_session(
            db,
            topic,
            status=QuizStatus.COMPLETED,
            started_at=datetime(2026, 1, day, 12, 0, tzinfo=timezone.utc),
            answered=[True],
            total_questions=1,
        )

    history = list_quiz_history(db, limit=2)

    assert len(history) == 2
    assert history[0]["started_at"] > history[1]["started_at"]
