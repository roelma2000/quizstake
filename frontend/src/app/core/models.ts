export interface Topic {
  id: number;
  name: string;
  description: string | null;
  mistake_limit: number;
  max_questions: number;
  active: boolean;
  question_count: number;
}

export interface Choice {
  id: number;
  text: string;
}

export interface PublicQuestion {
  session_question_id: number;
  number: number;
  total: number;
  prompt: string;
  choices: Choice[];
}

export interface QuizStartResponse {
  session_id: number;
  topic_id: number;
  total_questions: number;
  question: PublicQuestion;
}

export interface AnswerResponse {
  accepted: boolean;
  ended: boolean;
  end_reason: string | null;
  next_question: PublicQuestion | null;
}

export interface ReviewItem {
  number: number;
  prompt: string;
  selected_answer: string;
  correct_answer: string;
  correct: boolean;
  explanation: string | null;
}

export interface QuizResult {
  session_id: number;
  status: string;
  end_reason: string | null;
  total_questions: number;
  answered_questions: number;
  correct_answers: number;
  mistakes: number;
  score_percent: number;
  review: ReviewItem[];
}
