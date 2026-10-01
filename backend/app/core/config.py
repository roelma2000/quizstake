from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "QuizStake API"
    database_url: str = "postgresql+psycopg://postgres@localhost:5432/quizstake"
    cors_origins: str = "http://localhost:4200"
    global_max_questions: int = 100

    model_config = SettingsConfigDict(
        env_file=".env",
        env_prefix="QUIZSTAKE_",
        case_sensitive=False,
    )

    @property
    def cors_origin_list(self) -> list[str]:
        return [item.strip() for item in self.cors_origins.split(",") if item.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
