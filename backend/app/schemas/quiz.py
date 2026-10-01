from datetime import datetime

from pydantic import BaseModel, Field


class QuizStartRequest(BaseModel):
    topic_id: int
    question_count: int = Field(default=20, ge=1, le=100)


class PublicChoice(BaseModel):
    id: int
    text: str


class PublicQuestion(BaseModel):
    session_question_id: int
    number: int
    total: int
    prompt: str
    choices: list[PublicChoice]


class QuizStartResponse(BaseModel):
    session_id: int
    topic_id: int
    total_questions: int
    question: PublicQuestion


class AnswerSubmitRequest(BaseModel):
    session_question_id: int
    choice_id: int


class AnswerSubmitResponse(BaseModel):
    accepted: bool = True
    ended: bool
    end_reason: str | None = None
    next_question: PublicQuestion | None = None


class ReviewItem(BaseModel):
    number: int
    prompt: str
    selected_answer: str
    correct_answer: str
    correct: bool
    explanation: str | None = None


class QuizHistoryItem(BaseModel):
    session_id: int
    topic_id: int
    topic_name: str
    status: str
    end_reason: str | None
    started_at: datetime
    ended_at: datetime | None
    total_questions: int
    answered_questions: int
    correct_answers: int
    mistakes: int
    score_percent: float


class QuizResultResponse(BaseModel):
    session_id: int
    status: str
    end_reason: str | None
    total_questions: int
    answered_questions: int
    correct_answers: int
    mistakes: int
    score_percent: float
    review: list[ReviewItem]
