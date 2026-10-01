from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.question import Question
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
    existing = db.scalar(select(Topic).where(func.lower(Topic.name) == payload.name.lower()))
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Topic name already exists")
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
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(topic, field, value)
    db.commit()
    count = db.scalar(
        select(func.count(Question.id)).where(Question.topic_id == topic.id, Question.active.is_(True))
    ) or 0
    return _to_read(topic, count)
