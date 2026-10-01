from sqlalchemy import text

from app.db.session import engine


DDL = """
ALTER TABLE questions
ADD COLUMN IF NOT EXISTS prompt_alternatives JSON NOT NULL DEFAULT '[]'::json
"""


with engine.begin() as connection:
    connection.execute(text(DDL))

print("Question alternative wording column is ready.")
