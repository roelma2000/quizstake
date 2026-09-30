from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum

from sqlalchemy import DateTime, Enum as SqlEnum, ForeignKey, Integer, JSON, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class QuizStatus(str, Enum):
    ACTIVE = "active"
    COMPLETED = "completed"
    TERMINATED = "terminated"


class QuizEndReason(str, Enum):
    COMPLETED = "completed"
    MISTAKE_LIMIT = "mistake_limit"


class QuizSession(Base):
    __tablename__ = "quiz_sessions"

    id: Mapped[int] = mapped_column(primary_key=True)
    topic_id: Mapped[int] = mapped_column(ForeignKey("topics.id"), index=True)
    requested_count: Mapped[int] = mapped_column(Integer)
    mistake_limit: Mapped[int] = mapped_column(Integer)
    mistake_count: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[QuizStatus] = mapped_column(
        SqlEnum(QuizStatus, native_enum=False), default=QuizStatus.ACTIVE
    )
    end_reason: Mapped[str | None] = mapped_column(String(40), nullable=True)
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    questions = relationship(
        "QuizSessionQuestion",
        back_populates="session",
        cascade="all, delete-orphan",
        order_by="QuizSessionQuestion.position",
    )


class QuizSessionQuestion(Base):
    __tablename__ = "quiz_session_questions"

    id: Mapped[int] = mapped_column(primary_key=True)
    session_id: Mapped[int] = mapped_column(
        ForeignKey("quiz_sessions.id", ondelete="CASCADE"), index=True
    )
    question_id: Mapped[int] = mapped_column(ForeignKey("questions.id"), index=True)
    position: Mapped[int] = mapped_column(Integer)
    prompt_snapshot: Mapped[str] = mapped_column(String())
    choice_payload: Mapped[list[dict]] = mapped_column(JSON)
    selected_choice_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    is_correct: Mapped[int | None] = mapped_column(Integer, nullable=True)
    answered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    session = relationship("QuizSession", back_populates="questions")
    question = relationship("Question")
