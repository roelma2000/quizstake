from __future__ import annotations

import csv
import io
import json
from dataclasses import dataclass

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.models.question import AnswerChoice, Question
from app.models.topic import Topic


@dataclass
class ImportStats:
    imported: int = 0
    skipped: int = 0
    errors: list[str] | None = None

    def __post_init__(self) -> None:
        if self.errors is None:
            self.errors = []


def _truthy(value: object) -> bool:
    return str(value).strip().lower() in {"1", "true", "yes", "y"}


def _normalize_record(record: dict) -> dict:
    topic = str(record.get("topic", "")).strip()
    question = str(record.get("question", "")).strip()
    explanation = str(record.get("explanation", "")).strip() or None

    if "answers" in record:
        answers = record["answers"]
    else:
        answers = []
        for index in range(1, 4):
            alt_raw = str(record.get(f"answer{index}_alternatives", "")).strip()
            alternatives = [item.strip() for item in alt_raw.split("||") if item.strip()]
            answers.append(
                {
                    "text": str(record.get(f"answer{index}", "")).strip(),
                    "alternatives": alternatives,
                    "correct": _truthy(record.get(f"answer{index}_correct", False)),
                }
            )

    normalized_answers = []
    for answer in answers:
        alternatives = answer.get("alternatives") or []
        if isinstance(alternatives, str):
            alternatives = [item.strip() for item in alternatives.split("||") if item.strip()]
        normalized_answers.append(
            {
                "text": str(answer.get("text", "")).strip(),
                "alternatives": [str(item).strip() for item in alternatives if str(item).strip()],
                "correct": bool(answer.get("correct", False)),
            }
        )

    return {
        "topic": topic,
        "question": question,
        "explanation": explanation,
        "answers": normalized_answers,
    }


def _validate_record(record: dict, row_label: str) -> list[str]:
    errors = []
    if not record["topic"]:
        errors.append(f"{row_label}: topic is required")
    if not record["question"]:
        errors.append(f"{row_label}: question is required")
    if len(record["answers"]) != 3:
        errors.append(f"{row_label}: exactly three answers are required")
    if any(not answer["text"] for answer in record["answers"]):
        errors.append(f"{row_label}: all three answer texts are required")
    if sum(1 for answer in record["answers"] if answer["correct"]) != 1:
        errors.append(f"{row_label}: exactly one answer must be correct")
    return errors


def parse_upload(filename: str, content: bytes) -> list[dict]:
    lower = filename.lower()
    if lower.endswith(".json"):
        payload = json.loads(content.decode("utf-8-sig"))
        if not isinstance(payload, list):
            raise ValueError("JSON root must be an array")
        return [_normalize_record(item) for item in payload]
    if lower.endswith(".csv"):
        text = content.decode("utf-8-sig")
        reader = csv.DictReader(io.StringIO(text))
        return [_normalize_record(dict(row)) for row in reader]
    raise ValueError("Only .json and .csv files are supported")


def import_records(db: Session, records: list[dict]) -> ImportStats:
    stats = ImportStats()

    for index, record in enumerate(records, start=1):
        row_label = f"Record {index}"
        validation_errors = _validate_record(record, row_label)
        if validation_errors:
            stats.errors.extend(validation_errors)
            continue

        topic = db.scalar(select(Topic).where(func.lower(Topic.name) == record["topic"].lower()))
        if topic is None:
            topic = Topic(name=record["topic"])
            db.add(topic)
            db.flush()

        existing = db.scalar(
            select(Question)
            .options(selectinload(Question.choices))
            .where(
                Question.topic_id == topic.id,
                func.lower(Question.prompt) == record["question"].lower(),
            )
        )
        if existing is not None:
            stats.skipped += 1
            continue

        question = Question(
            topic_id=topic.id,
            prompt=record["question"],
            explanation=record["explanation"],
        )
        db.add(question)
        db.flush()

        for answer in record["answers"]:
            db.add(
                AnswerChoice(
                    question_id=question.id,
                    text=answer["text"],
                    alternatives=answer["alternatives"],
                    is_correct=answer["correct"],
                )
            )
        stats.imported += 1

    db.commit()
    return stats
