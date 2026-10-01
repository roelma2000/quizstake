from fastapi import APIRouter, Depends, File, HTTPException, Query, Response, UploadFile, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload, selectinload

from app.db.session import get_db
from app.models.question import AnswerChoice, Question
from app.models.quiz import QuizSessionQuestion
from app.models.topic import Topic
from app.schemas.imports import ImportResult
from app.schemas.question import QuestionCreate, QuestionRead, QuestionUpdate
from app.services.importer import import_records, parse_upload

router = APIRouter(prefix="/questions", tags=["questions"])


def _to_read(question: Question) -> QuestionRead:
    return QuestionRead(
        id=question.id,
        topic_id=question.topic_id,
        topic_name=question.topic.name,
        prompt=question.prompt,
        explanation=question.explanation,
        active=question.active,
        choices=question.choices,
    )


def _get_topic(db: Session, topic_id: int) -> Topic:
    topic = db.get(Topic, topic_id)
    if topic is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Topic not found")
    return topic


def _ensure_unique_prompt(
    db: Session,
    topic_id: int,
    prompt: str,
    exclude_question_id: int | None = None,
) -> None:
    stmt = select(Question.id).where(
        Question.topic_id == topic_id,
        func.lower(Question.prompt) == prompt.lower(),
    )
    if exclude_question_id is not None:
        stmt = stmt.where(Question.id != exclude_question_id)
    if db.scalar(stmt) is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A question with this prompt already exists in the topic",
        )


def _load_question(db: Session, question_id: int) -> Question:
    stmt = (
        select(Question)
        .options(selectinload(Question.choices), joinedload(Question.topic))
        .where(Question.id == question_id)
    )
    question = db.scalar(stmt)
    if question is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Question not found")
    return question


@router.get("", response_model=list[QuestionRead])
def list_questions(
    topic_id: int | None = Query(default=None, gt=0),
    active: bool | None = Query(default=None),
    db: Session = Depends(get_db),
) -> list[QuestionRead]:
    stmt = (
        select(Question)
        .options(selectinload(Question.choices), joinedload(Question.topic))
        .order_by(Question.topic_id, Question.id)
    )
    if topic_id is not None:
        stmt = stmt.where(Question.topic_id == topic_id)
    if active is not None:
        stmt = stmt.where(Question.active.is_(active))
    return [_to_read(question) for question in db.scalars(stmt).all()]


@router.get("/{question_id}", response_model=QuestionRead)
def get_question(question_id: int, db: Session = Depends(get_db)) -> QuestionRead:
    return _to_read(_load_question(db, question_id))


@router.post("", response_model=QuestionRead, status_code=status.HTTP_201_CREATED)
def create_question(payload: QuestionCreate, db: Session = Depends(get_db)) -> QuestionRead:
    _get_topic(db, payload.topic_id)
    _ensure_unique_prompt(db, payload.topic_id, payload.prompt)

    question = Question(
        topic_id=payload.topic_id,
        prompt=payload.prompt,
        explanation=payload.explanation,
        active=payload.active,
    )
    db.add(question)
    db.flush()

    for choice in payload.choices:
        db.add(
            AnswerChoice(
                question_id=question.id,
                text=choice.text,
                alternatives=choice.alternatives,
                is_correct=choice.is_correct,
            )
        )

    db.commit()
    return _to_read(_load_question(db, question.id))


@router.patch("/{question_id}", response_model=QuestionRead)
def update_question(
    question_id: int,
    payload: QuestionUpdate,
    db: Session = Depends(get_db),
) -> QuestionRead:
    question = _load_question(db, question_id)
    updates = payload.model_dump(exclude_unset=True, exclude={"choices"})

    target_topic_id = updates.get("topic_id", question.topic_id)
    target_prompt = updates.get("prompt", question.prompt)

    if "topic_id" in updates:
        _get_topic(db, target_topic_id)

    if target_topic_id != question.topic_id or target_prompt.lower() != question.prompt.lower():
        _ensure_unique_prompt(db, target_topic_id, target_prompt, exclude_question_id=question.id)

    for field, value in updates.items():
        setattr(question, field, value)

    if payload.choices is not None:
        existing_choices = sorted(question.choices, key=lambda choice: choice.id)
        if len(existing_choices) != 3:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Question does not currently have exactly three answers",
            )
        for existing, incoming in zip(existing_choices, payload.choices, strict=True):
            existing.text = incoming.text
            existing.alternatives = incoming.alternatives
            existing.is_correct = incoming.is_correct

    db.commit()
    return _to_read(_load_question(db, question.id))


@router.delete("/{question_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_question(question_id: int, db: Session = Depends(get_db)) -> Response:
    question = _load_question(db, question_id)
    usage_count = db.scalar(
        select(func.count(QuizSessionQuestion.id)).where(
            QuizSessionQuestion.question_id == question.id
        )
    ) or 0
    if usage_count:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Question has quiz history and cannot be deleted; deactivate it instead",
        )

    db.delete(question)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/import", response_model=ImportResult)
async def bulk_import_questions(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
) -> ImportResult:
    try:
        content = await file.read()
        records = parse_upload(file.filename or "", content)
        stats = import_records(db, records)
        return ImportResult(imported=stats.imported, skipped=stats.skipped, errors=stats.errors or [])
    except (UnicodeDecodeError, ValueError, KeyError) as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
