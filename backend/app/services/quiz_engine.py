from __future__ import annotations

import secrets
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.config import get_settings
from app.models.question import AnswerChoice, Question
from app.models.quiz import QuizEndReason, QuizSession, QuizSessionQuestion, QuizStatus
from app.models.topic import Topic
from app.schemas.quiz import PublicChoice, PublicQuestion, ReviewItem

_rng = secrets.SystemRandom()


def _clean_variants(choice: AnswerChoice) -> list[str]:
    values = [choice.text]
    values.extend(item.strip() for item in (choice.alternatives or []) if item and item.strip())
    # Preserve order while removing duplicates.
    return list(dict.fromkeys(values))


def _load_eligible_questions(db: Session, topic_id: int) -> list[Question]:
    stmt = (
        select(Question)
        .options(selectinload(Question.choices))
        .where(Question.topic_id == topic_id, Question.active.is_(True))
    )
    questions = list(db.scalars(stmt).all())
    return [q for q in questions if len(q.choices) == 3 and sum(c.is_correct for c in q.choices) == 1]


def _public_question(session_question: QuizSessionQuestion, total: int) -> PublicQuestion:
    return PublicQuestion(
        session_question_id=session_question.id,
        number=session_question.position,
        total=total,
        prompt=session_question.prompt_snapshot,
        choices=[PublicChoice(id=item["id"], text=item["text"]) for item in session_question.choice_payload],
    )


def start_quiz(db: Session, topic_id: int, requested_count: int) -> tuple[QuizSession, PublicQuestion]:
    topic = db.get(Topic, topic_id)
    if topic is None or not topic.active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Topic not found or inactive")

    eligible = _load_eligible_questions(db, topic_id)
    if not eligible:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Topic has no active questions with exactly three answers and one correct answer",
        )

    settings = get_settings()
    count = min(
        requested_count,
        topic.max_questions,
        settings.global_max_questions,
        len(eligible),
    )

    # Randomization stage 1: unique random sample from the topic pool.
    selected = _rng.sample(eligible, k=count)
    # Randomization stage 2: independent final-order shuffle.
    _rng.shuffle(selected)

    session = QuizSession(
        topic_id=topic.id,
        requested_count=count,
        mistake_limit=topic.mistake_limit,
        mistake_count=0,
        status=QuizStatus.ACTIVE,
    )
    db.add(session)
    db.flush()

    for position, question in enumerate(selected, start=1):
        choice_payload = []
        for choice in question.choices:
            variants = _clean_variants(choice)
            choice_payload.append({"id": choice.id, "text": _rng.choice(variants)})
        _rng.shuffle(choice_payload)

        session_question = QuizSessionQuestion(
            session_id=session.id,
            question_id=question.id,
            position=position,
            prompt_snapshot=question.prompt,
            choice_payload=choice_payload,
        )
        db.add(session_question)

    db.commit()
    db.refresh(session)
    first = session.questions[0]
    return session, _public_question(first, len(session.questions))


def submit_answer(
    db: Session,
    session_id: int,
    session_question_id: int,
    choice_id: int,
) -> tuple[QuizSession, PublicQuestion | None]:
    stmt = (
        select(QuizSession)
        .options(
            selectinload(QuizSession.questions)
            .selectinload(QuizSessionQuestion.question)
            .selectinload(Question.choices)
        )
        .where(QuizSession.id == session_id)
    )
    session = db.scalar(stmt)
    if session is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quiz session not found")
    if session.status != QuizStatus.ACTIVE:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Quiz session has already ended")

    unanswered = [item for item in session.questions if item.selected_choice_id is None]
    if not unanswered:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="No unanswered questions remain")

    current = unanswered[0]
    if current.id != session_question_id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Answers must be submitted in quiz order",
        )

    allowed_choice_ids = {item["id"] for item in current.choice_payload}
    if choice_id not in allowed_choice_ids:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Choice does not belong to this question")

    correct_choice = next(choice for choice in current.question.choices if choice.is_correct)
    is_correct = choice_id == correct_choice.id

    current.selected_choice_id = choice_id
    current.is_correct = 1 if is_correct else 0
    current.answered_at = datetime.now(timezone.utc)

    if not is_correct:
        session.mistake_count += 1

    next_question = None
    if session.mistake_count >= session.mistake_limit:
        session.status = QuizStatus.TERMINATED
        session.end_reason = QuizEndReason.MISTAKE_LIMIT.value
        session.ended_at = datetime.now(timezone.utc)
    else:
        remaining = [item for item in session.questions if item.selected_choice_id is None]
        if not remaining:
            session.status = QuizStatus.COMPLETED
            session.end_reason = QuizEndReason.COMPLETED.value
            session.ended_at = datetime.now(timezone.utc)
        else:
            next_question = _public_question(remaining[0], len(session.questions))

    db.commit()
    db.refresh(session)
    return session, next_question


def build_results(db: Session, session_id: int) -> dict:
    stmt = (
        select(QuizSession)
        .options(
            selectinload(QuizSession.questions)
            .selectinload(QuizSessionQuestion.question)
            .selectinload(Question.choices)
        )
        .where(QuizSession.id == session_id)
    )
    session = db.scalar(stmt)
    if session is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quiz session not found")
    if session.status == QuizStatus.ACTIVE:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Results are available only after the quiz ends",
        )

    review: list[ReviewItem] = []
    answered = [item for item in session.questions if item.selected_choice_id is not None]
    correct_count = 0

    for item in answered:
        payload_by_id = {choice["id"]: choice["text"] for choice in item.choice_payload}
        correct_choice = next(choice for choice in item.question.choices if choice.is_correct)
        correct_text = payload_by_id.get(correct_choice.id, correct_choice.text)
        selected_text = payload_by_id.get(item.selected_choice_id, "Unknown answer")
        correct = bool(item.is_correct)
        correct_count += 1 if correct else 0
        review.append(
            ReviewItem(
                number=item.position,
                prompt=item.prompt_snapshot,
                selected_answer=selected_text,
                correct_answer=correct_text,
                correct=correct,
                explanation=item.question.explanation,
            )
        )

    score = round((correct_count / len(answered)) * 100, 2) if answered else 0.0
    return {
        "session_id": session.id,
        "status": session.status.value,
        "end_reason": session.end_reason,
        "total_questions": len(session.questions),
        "answered_questions": len(answered),
        "correct_answers": correct_count,
        "mistakes": session.mistake_count,
        "score_percent": score,
        "review": review,
    }
