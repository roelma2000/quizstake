from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, ForeignKey, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Question(Base):
    __tablename__ = "questions"

    id: Mapped[int] = mapped_column(primary_key=True)
    topic_id: Mapped[int] = mapped_column(ForeignKey("topics.id", ondelete="CASCADE"), index=True)
    prompt: Mapped[str] = mapped_column(Text())
    prompt_alternatives: Mapped[list[str]] = mapped_column(JSON, default=list)
    explanation: Mapped[str | None] = mapped_column(Text(), nullable=True)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    topic = relationship("Topic", back_populates="questions")
    choices = relationship(
        "AnswerChoice",
        back_populates="question",
        cascade="all, delete-orphan",
        order_by="AnswerChoice.id",
    )


class AnswerChoice(Base):
    __tablename__ = "answer_choices"

    id: Mapped[int] = mapped_column(primary_key=True)
    question_id: Mapped[int] = mapped_column(
        ForeignKey("questions.id", ondelete="CASCADE"), index=True
    )
    text: Mapped[str] = mapped_column(Text())
    alternatives: Mapped[list[str]] = mapped_column(JSON, default=list)
    is_correct: Mapped[bool] = mapped_column(Boolean, default=False)

    question = relationship("Question", back_populates="choices")
