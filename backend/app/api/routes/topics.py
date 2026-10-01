from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.question import Question
from app.models.quiz import QuizSession
from app.models.topic import Topic
from app.schemas.topic import TopicCreate, TopicRead, TopicUpdate

router = APIRouter(prefix="/topics", tags=["topics"])


def _to_read(topic: Topic, question_count: int) -> TopicRead:
    return TopicRead(
        id=topic.id,
        name=topic.name,
        description=topic.description,
        mistake_limit=topic.mistake_limit,
        max_questions=topic.max_questions,
        active=topic.active,
        question_count=question_count,
    )


def _question_count(db: Session, topic_id: int) -> int:
    return db.scalar(
        select(func.count(Question.id)).where(
            Question.topic_id == topic_id,
            Question.active.is_(True),
        )
    ) or 0


def _ensure_unique_name(
    db: Session,
    name: str,
    exclude_topic_id: int | None = None,
) -> None:
    stmt = select(Topic.id).where(func.lower(Topic.name) == name.lower())
    if exclude_topic_id is not None:
        stmt = stmt.where(Topic.id != exclude_topic_id)
    if db.scalar(stmt) is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Topic name already exists",
        )


@router.get("", response_model=list[TopicRead])
def list_topics(db: Session = Depends(get_db)) -> list[TopicRead]:
    rows = db.execute(
        select(Topic, func.count(Question.id))
        .outerjoin(Question, (Question.topic_id == Topic.id) & (Question.active.is_(True)))
        .group_by(Topic.id)
        .order_by(Topic.name)
    ).all()
    return [_to_read(topic, count) for topic, count in rows]


@router.post("", response_model=TopicRead, status_code=status.HTTP_201_CREATED)
def create_topic(payload: TopicCreate, db: Session = Depends(get_db)) -> TopicRead:
    _ensure_unique_name(db, payload.name)
    topic = Topic(**payload.model_dump())
    db.add(topic)
    db.commit()
    db.refresh(topic)
    return _to_read(topic, 0)


@router.patch("/{topic_id}", response_model=TopicRead)
def update_topic(topic_id: int, payload: TopicUpdate, db: Session = Depends(get_db)) -> TopicRead:
    topic = db.get(Topic, topic_id)
    if topic is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Topic not found")

    updates = payload.model_dump(exclude_unset=True)
    if "name" in updates and updates["name"].lower() != topic.name.lower():
        _ensure_unique_name(db, updates["name"], exclude_topic_id=topic.id)

    for field, value in updates.items():
        setattr(topic, field, value)
    db.commit()
    db.refresh(topic)
    return _to_read(topic, _question_count(db, topic.id))


@router.delete("/{topic_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_topic(topic_id: int, db: Session = Depends(get_db)) -> Response:
    topic = db.get(Topic, topic_id)
    if topic is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Topic not found")

    total_questions = db.scalar(
        select(func.count(Question.id)).where(Question.topic_id == topic.id)
    ) or 0
    quiz_sessions = db.scalar(
        select(func.count(QuizSession.id)).where(QuizSession.topic_id == topic.id)
    ) or 0

    if total_questions or quiz_sessions:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Topic cannot be deleted while it has questions or quiz history; "
                "deactivate it instead"
            ),
        )

    db.delete(topic)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
