from pydantic import BaseModel


class ImportResult(BaseModel):
    imported: int
    skipped: int
    errors: list[str]
