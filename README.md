# QuizStake

QuizStake is a randomized learning and exam-practice application built with Angular and FastAPI.

## Core rules

- Questions are selected purely at random within the chosen topic/module.
- No spaced-repetition weighting or "show again in X days" scheduling affects question selection.
- A quiz can contain at most 100 unique questions.
- Quiz question randomization is performed in two stages:
  1. randomly sample unique questions from the topic pool;
  2. shuffle the sampled set again for final presentation order.
- Every question has exactly three answer choices.
- Each answer choice may have zero or more alternative/paraphrased display texts.
- One display text is randomly selected for each answer choice when a quiz session is created.
- The three answer choices are then shuffled independently.
- The correct answer is tracked by answer-choice ID, never by display position or text.
- The mistake limit is configurable per topic and defaults to 5.
- The current mistake count is not returned to the quiz screen.
- When the mistake limit is reached, the session ends immediately.
- Detailed correct/incorrect review is available only after the session ends.

## Repository layout

```text
quizstake/
├─ backend/      FastAPI + SQLAlchemy API
├─ frontend/     Angular standalone application
└─ README.md
```

## Backend

Requirements: Python 3.12+ recommended.

```bash
cd backend
python -m venv .venv
# Windows PowerShell
.\.venv\Scripts\Activate.ps1
pip install -e .[dev]
fastapi dev app/main.py
```

API: `http://127.0.0.1:8000`
OpenAPI: `http://127.0.0.1:8000/docs`

The starter uses SQLite (`backend/quizstake.db`) so no database server is required for local development.

### Load sample data

Use the Angular Bulk Import page or call:

```text
POST /api/v1/questions/import
```

with `backend/sample-data/questions.json` or `questions.csv`.

## Frontend

Angular 22 requires a supported Node.js version. Use Node.js 22.22.3+ (or another version supported by Angular 22).

```bash
cd frontend
npm install
npm start
```

UI: `http://localhost:4200`

## Bulk JSON format

```json
[
  {
    "topic": "Module 1",
    "question": "What should a driver do at a red traffic light?",
    "explanation": "A steady red signal requires a complete stop.",
    "answers": [
      {
        "text": "Come to a complete stop",
        "alternatives": ["Stop the vehicle completely", "Bring the vehicle to a full stop"],
        "correct": true
      },
      {
        "text": "Slow down and continue",
        "alternatives": ["Reduce speed and keep moving"],
        "correct": false
      },
      {
        "text": "Speed up through the intersection",
        "alternatives": [],
        "correct": false
      }
    ]
  }
]
```

Each question must contain exactly three answers and exactly one correct answer.

## Bulk CSV format

Columns:

```text
topic,question,explanation,answer1,answer1_alternatives,answer1_correct,answer2,answer2_alternatives,answer2_correct,answer3,answer3_alternatives,answer3_correct
```

Use `||` between multiple alternative answer texts.

## Initial API flow

1. `GET /api/v1/topics`
2. `POST /api/v1/quizzes/start`
3. Repeatedly `POST /api/v1/quizzes/{session_id}/answer`
4. When the response reports `ended: true`, call `GET /api/v1/quizzes/{session_id}/results`

The answer submission response intentionally does not expose whether the answer was correct while the quiz remains active.
