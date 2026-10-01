-- Add alternative wording support for existing PostgreSQL databases.
ALTER TABLE questions
ADD COLUMN IF NOT EXISTS prompt_alternatives JSON NOT NULL DEFAULT '[]'::json;
