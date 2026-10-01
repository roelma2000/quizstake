from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models.quiz import QuizSession, QuizSessionQuestion, QuizStatus
from app.models.topic import Topic


def build_performance_analysis(
    db: Session,
    topic_id: int | None = None,
    weak_limit: int = 20,
) -> dict:
    stmt = (
        select(QuizSession, Topic)
        .join(Topic, Topic.id == QuizSession.topic_id)
        .options(
            selectinload(QuizSession.questions)
            .selectinload(QuizSessionQuestion.question)
        )
        .where(QuizSession.status != QuizStatus.ACTIVE)
        .order_by(QuizSession.started_at.asc(), QuizSession.id.asc())
    )
    if topic_id is not None:
        stmt = stmt.where(QuizSession.topic_id == topic_id)

    topic_stats: dict[int, dict] = {}
    question_stats: dict[int, dict] = {}

    for quiz_session, topic in db.execute(stmt).all():
        topic_item = topic_stats.setdefault(
            topic.id,
            {
                "topic_id": topic.id,
                "topic_name": topic.name,
                "attempts": 0,
                "answered_questions": 0,
                "correct_answers": 0,
                "mistakes": 0,
            },
        )
        topic_item["attempts"] += 1

        for session_question in quiz_session.questions:
            if session_question.selected_choice_id is None:
                continue

            correct = bool(session_question.is_correct)
            topic_item["answered_questions"] += 1
            if correct:
                topic_item["correct_answers"] += 1
            else:
                topic_item["mistakes"] += 1

            question = session_question.question
            question_item = question_stats.setdefault(
                question.id,
                {
                    "question_id": question.id,
                    "topic_id": topic.id,
                    "topic_name": topic.name,
                    "prompt": question.prompt,
                    "attempts": 0,
                    "correct_answers": 0,
                    "incorrect_answers": 0,
                    "last_answered_at": None,
                },
            )
            question_item["attempts"] += 1
            if correct:
                question_item["correct_answers"] += 1
            else:
                question_item["incorrect_answers"] += 1

            answered_at = session_question.answered_at
            if answered_at is not None:
                previous = question_item["last_answered_at"]
                if previous is None or answered_at > previous:
                    question_item["last_answered_at"] = answered_at

    topics: list[dict] = []
    for item in topic_stats.values():
        answered = item["answered_questions"]
        item["accuracy_percent"] = (
            round((item["correct_answers"] / answered) * 100, 2)
            if answered
            else 0.0
        )
        topics.append(item)

    topics.sort(key=lambda item: item["topic_name"].casefold())

    weak_questions: list[dict] = []
    for item in question_stats.values():
        if item["incorrect_answers"] == 0:
            continue
        item["accuracy_percent"] = round(
            (item["correct_answers"] / item["attempts"]) * 100,
            2,
        )
        weak_questions.append(item)

    weak_questions.sort(
        key=lambda item: (
            -item["incorrect_answers"],
            item["accuracy_percent"],
            -item["attempts"],
            item["question_id"],
        )
    )

    return {
        "topics": topics,
        "weak_questions": weak_questions[:weak_limit],
    }
