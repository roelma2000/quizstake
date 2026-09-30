import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { AnswerResponse, QuizResult, QuizStartResponse, Topic } from './models';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly baseUrl = 'http://127.0.0.1:8000/api/v1';

  constructor(private readonly http: HttpClient) {}

  getTopics(): Observable<Topic[]> {
    return this.http.get<Topic[]>(`${this.baseUrl}/topics`);
  }

  startQuiz(topicId: number, questionCount: number): Observable<QuizStartResponse> {
    return this.http.post<QuizStartResponse>(`${this.baseUrl}/quizzes/start`, {
      topic_id: topicId,
      question_count: questionCount
    });
  }

  submitAnswer(sessionId: number, sessionQuestionId: number, choiceId: number): Observable<AnswerResponse> {
    return this.http.post<AnswerResponse>(`${this.baseUrl}/quizzes/${sessionId}/answer`, {
      session_question_id: sessionQuestionId,
      choice_id: choiceId
    });
  }

  getResults(sessionId: number): Observable<QuizResult> {
    return this.http.get<QuizResult>(`${this.baseUrl}/quizzes/${sessionId}/results`);
  }

  importQuestions(file: File): Observable<{ imported: number; skipped: number; errors: string[] }> {
    const form = new FormData();
    form.append('file', file);
    return this.http.post<{ imported: number; skipped: number; errors: string[] }>(
      `${this.baseUrl}/questions/import`, form
    );
  }
}
