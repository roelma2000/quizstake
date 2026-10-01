from pydantic import BaseModel, ConfigDict, Field, field_validator


class TopicCreate(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    description: str | None = None
    mistake_limit: int = Field(default=5, ge=1, le=100)
    max_questions: int = Field(default=100, ge=1, le=100)

    model_config = ConfigDict(str_strip_whitespace=True)

    @field_validator("name")
    @classmethod
    def clean_name(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("topic name is required")
        return value


class TopicUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=160)
    description: str | None = None
    mistake_limit: int | None = Field(default=None, ge=1, le=100)
    max_questions: int | None = Field(default=None, ge=1, le=100)
    active: bool | None = None

    model_config = ConfigDict(str_strip_whitespace=True)

    @field_validator("name")
    @classmethod
    def clean_name(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        if not value:
            raise ValueError("topic name is required")
        return value


class TopicRead(BaseModel):
    id: int
    name: str
    description: str | None
    mistake_limit: int
    max_questions: int
    active: bool
    question_count: int = 0

    model_config = ConfigDict(from_attributes=True)
