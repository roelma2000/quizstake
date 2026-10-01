from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.performance import PerformanceResponse
from app.services.performance import build_performance_analysis

router = APIRouter(prefix="/performance", tags=["performance"])


@router.get("", response_model=PerformanceResponse)
def performance(
    topic_id: int | None = Query(default=None, gt=0),
    weak_limit: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
) -> PerformanceResponse:
    return PerformanceResponse(
        **build_performance_analysis(
            db,
            topic_id=topic_id,
            weak_limit=weak_limit,
        )
    )
