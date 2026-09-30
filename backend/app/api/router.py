from fastapi import APIRouter

from app.api.routes import questions, quizzes, topics

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(topics.router)
api_router.include_router(questions.router)
api_router.include_router(quizzes.router)
