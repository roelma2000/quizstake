from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.quiz import (
    AnswerSubmitRequest,
    AnswerSubmitResponse,
    QuizResultResponse,
    QuizStartRequest,
    QuizStartResponse,
)
from app.services.quiz_engine import build_results, start_quiz, submit_answer

router = APIRouter(prefix="/quizzes", tags=["quizzes"])


@router.post("/start", response_model=QuizStartResponse)
def start(payload: QuizStartRequest, db: Session = Depends(get_db)) -> QuizStartResponse:
    session, question = start_quiz(db, payload.topic_id, payload.question_count)
    return QuizStartResponse(
        session_id=session.id,
        topic_id=session.topic_id,
        total_questions=len(session.questions),
        question=question,
    )


@router.post("/{session_id}/answer", response_model=AnswerSubmitResponse)
def answer(
    session_id: int,
    payload: AnswerSubmitRequest,
    db: Session = Depends(get_db),
) -> AnswerSubmitResponse:
    session, next_question = submit_answer(
        db,
        session_id=session_id,
        session_question_id=payload.session_question_id,
        choice_id=payload.choice_id,
    )
    return AnswerSubmitResponse(
        ended=session.status.value != "active",
        end_reason=session.end_reason,
        next_question=next_question,
    )


@router.get("/{session_id}/results", response_model=QuizResultResponse)
def results(session_id: int, db: Session = Depends(get_db)) -> QuizResultResponse:
    return QuizResultResponse(**build_results(db, session_id))
