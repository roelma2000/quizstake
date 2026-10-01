from pydantic import BaseModel, ConfigDict, Field


class TopicCreate(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    description: str | None = None
    mistake_limit: int = Field(default=5, ge=1, le=100)
    max_questions: int = Field(default=100, ge=1, le=100)


class TopicUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=160)
    description: str | None = None
    mistake_limit: int | None = Field(default=None, ge=1, le=100)
    max_questions: int | None = Field(default=None, ge=1, le=100)
    active: bool | None = None


class TopicRead(BaseModel):
    id: int
    name: str
    description: str | None
    mistake_limit: int
    max_questions: int
    active: bool
    question_count: int = 0

    model_config = ConfigDict(from_attributes=True)
