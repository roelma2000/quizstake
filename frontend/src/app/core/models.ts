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


export interface AdminAnswerChoice {
  id: number;
  text: string;
  alternatives: string[];
  is_correct: boolean;
}

export interface AdminQuestion {
  id: number;
  topic_id: number;
  topic_name: string;
  prompt: string;
  prompt_alternatives: string[];
  explanation: string | null;
  active: boolean;
  choices: AdminAnswerChoice[];
}

export interface QuestionChoiceInput {
  text: string;
  alternatives: string[];
  is_correct: boolean;
}

export interface QuestionPayload {
  topic_id: number;
  prompt: string;
  prompt_alternatives: string[];
  explanation: string | null;
  active: boolean;
  choices: QuestionChoiceInput[];
}


export interface TopicPayload {
  name: string;
  description: string | null;
  mistake_limit: number;
  max_questions: number;
  active?: boolean;
}


export interface QuizHistoryItem {
  session_id: number;
  topic_id: number;
  topic_name: string;
  status: string;
  end_reason: string | null;
  started_at: string;
  ended_at: string | null;
  total_questions: number;
  answered_questions: number;
  correct_answers: number;
  mistakes: number;
  score_percent: number;
}


export interface TopicPerformance {
  topic_id: number;
  topic_name: string;
  attempts: number;
  answered_questions: number;
  correct_answers: number;
  mistakes: number;
  accuracy_percent: number;
}

export interface WeakQuestionPerformance {
  question_id: number;
  topic_id: number;
  topic_name: string;
  prompt: string;
  attempts: number;
  correct_answers: number;
  incorrect_answers: number;
  accuracy_percent: number;
  last_answered_at: string | null;
}

export interface PerformanceAnalysis {
  topics: TopicPerformance[];
  weak_questions: WeakQuestionPerformance[];
}
