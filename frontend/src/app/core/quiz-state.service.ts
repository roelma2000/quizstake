import { Injectable } from '@angular/core';
import { PublicQuestion } from './models';

@Injectable({ providedIn: 'root' })
export class QuizStateService {
  private readonly keyPrefix = 'quizstake-session-';

  saveQuestion(sessionId: number, question: PublicQuestion): void {
    sessionStorage.setItem(`${this.keyPrefix}${sessionId}`, JSON.stringify(question));
  }

  loadQuestion(sessionId: number): PublicQuestion | null {
    const raw = sessionStorage.getItem(`${this.keyPrefix}${sessionId}`);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as PublicQuestion;
    } catch {
      return null;
    }
  }

  clear(sessionId: number): void {
    sessionStorage.removeItem(`${this.keyPrefix}${sessionId}`);
  }
}
