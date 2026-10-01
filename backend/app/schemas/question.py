from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class AnswerChoiceInput(BaseModel):
    text: str = Field(min_length=1)
    alternatives: list[str] = Field(default_factory=list)
    is_correct: bool = False

    @field_validator("text")
    @classmethod
    def clean_text(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("answer text is required")
        return value

    @field_validator("alternatives")
    @classmethod
    def clean_alternatives(cls, values: list[str]) -> list[str]:
        cleaned = [value.strip() for value in values if value.strip()]
        return list(dict.fromkeys(cleaned))


class QuestionCreate(BaseModel):
    topic_id: int = Field(gt=0)
    prompt: str = Field(min_length=1)
    explanation: str | None = None
    active: bool = True
    choices: list[AnswerChoiceInput] = Field(min_length=3, max_length=3)

    model_config = ConfigDict(str_strip_whitespace=True)

    @model_validator(mode="after")
    def validate_choices(self) -> "QuestionCreate":
        if sum(choice.is_correct for choice in self.choices) != 1:
            raise ValueError("exactly one answer must be correct")
        return self


class QuestionUpdate(BaseModel):
    topic_id: int | None = Field(default=None, gt=0)
    prompt: str | None = Field(default=None, min_length=1)
    explanation: str | None = None
    active: bool | None = None
    choices: list[AnswerChoiceInput] | None = Field(default=None, min_length=3, max_length=3)

    model_config = ConfigDict(str_strip_whitespace=True)

    @model_validator(mode="after")
    def validate_choices(self) -> "QuestionUpdate":
        if self.choices is not None and sum(choice.is_correct for choice in self.choices) != 1:
            raise ValueError("exactly one answer must be correct")
        return self


class AnswerChoiceRead(BaseModel):
    id: int
    text: str
    alternatives: list[str]
    is_correct: bool

    model_config = ConfigDict(from_attributes=True)


class QuestionRead(BaseModel):
    id: int
    topic_id: int
    topic_name: str
    prompt: str
    explanation: str | None
    active: bool
    choices: list[AnswerChoiceRead]
