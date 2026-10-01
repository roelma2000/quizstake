from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.imports import ImportResult
from app.services.importer import import_records, parse_upload

router = APIRouter(prefix="/questions", tags=["questions"])


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
