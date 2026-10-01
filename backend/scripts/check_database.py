from sqlalchemy import create_engine, text

from app.core.config import get_settings


settings = get_settings()
engine = create_engine(settings.database_url)

with engine.connect() as connection:
    database = connection.execute(text("select current_database()" )).scalar_one()
    version = connection.execute(text("select version()" )).scalar_one()

print(f"Connected database: {database}")
print(version)
