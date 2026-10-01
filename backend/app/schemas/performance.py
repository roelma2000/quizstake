from datetime import datetime

from pydantic import BaseModel


class TopicPerformance(BaseModel):
    topic_id: int
    topic_name: str
    attempts: int
    answered_questions: int
    correct_answers: int
    mistakes: int
    accuracy_percent: float


class WeakQuestionPerformance(BaseModel):
    question_id: int
    topic_id: int
    topic_name: str
    prompt: str
    attempts: int
    correct_answers: int
    incorrect_answers: int
    accuracy_percent: float
    last_answered_at: datetime | None = None


class PerformanceResponse(BaseModel):
    topics: list[TopicPerformance]
    weak_questions: list[WeakQuestionPerformance]
