import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { PublicQuestion } from '../../core/models';
import { QuizStateService } from '../../core/quiz-state.service';

@Component({
  selector: 'app-quiz',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section *ngIf="question" class="quiz-shell">
      <div class="progress-row">
        <strong>Question {{ question.number }} of {{ question.total }}</strong>
        <span class="muted">Choose one answer</span>
      </div>
      <div class="progress"><span [style.width.%]="progress"></span></div>

      <article class="card question-card">
        <h1>{{ question.prompt }}</h1>
        <div class="choices">
          <button
            *ngFor="let choice of question.choices; let i = index"
            class="choice"
            [class.selected]="selectedChoiceId === choice.id"
            [disabled]="submitting"
            (click)="selectedChoiceId = choice.id">
            <span class="badge">{{ labels[i] }}</span>
            <span>{{ choice.text }}</span>
          </button>
        </div>
        <button class="btn submit" [disabled]="!selectedChoiceId || submitting" (click)="submit()">
          {{ submitting ? 'Submitting…' : 'Submit Answer' }}
        </button>
        <p *ngIf="error" class="error">{{ error }}</p>
      </article>

      <p class="privacy-note">The current mistake count is intentionally hidden during the session.</p>
    </section>

    <section *ngIf="!question && !error" class="card">Loading quiz…</section>
  `,
  styles: [`
    .quiz-shell { max-width:820px; margin:0 auto; }
    .progress-row { display:flex; justify-content:space-between; gap:12px; margin-bottom:10px; }
    .progress { height:8px; border-radius:999px; background:#e4e7ec; overflow:hidden; margin-bottom:22px; }
    .progress span { display:block; height:100%; background:#1f5eff; }
    .question-card h1 { margin-top:0; font-size:28px; line-height:1.3; }
    .choices { display:grid; gap:12px; margin:24px 0; }
    .choice { display:flex; align-items:flex-start; gap:12px; width:100%; text-align:left; border:1px solid #cfd6e2; border-radius:12px; padding:15px; background:#fff; color:#172033; }
    .choice:hover { border-color:#7d9cff; }
    .choice.selected { border-color:#1f5eff; box-shadow:0 0 0 2px rgba(31,94,255,.13); }
    .badge { flex:0 0 28px; width:28px; height:28px; border-radius:50%; display:grid; place-items:center; background:#eef2ff; color:#2f4cb3; font-weight:800; }
    .submit { width:100%; }
    .privacy-note { text-align:center; color:#667085; font-size:13px; margin-top:16px; }
  `]
})
export class QuizComponent implements OnInit {
  readonly labels = ['A', 'B', 'C'];
  sessionId = 0;
  question: PublicQuestion | null = null;
  selectedChoiceId: number | null = null;
  submitting = false;
  error = '';

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly api: ApiService,
    private readonly state: QuizStateService,
    private readonly cdr: ChangeDetectorRef
  ) {}

  get progress(): number {
    if (!this.question) return 0;
    return (this.question.number / this.question.total) * 100;
  }

  ngOnInit(): void {
    this.sessionId = Number(this.route.snapshot.paramMap.get('sessionId'));
    this.question = this.state.loadQuestion(this.sessionId);
    if (!this.sessionId || !this.question) {
      this.error = 'Quiz state was not found. Start a new quiz from the home page.';
    }
  }

  submit(): void {
    if (!this.question || !this.selectedChoiceId) return;
    this.submitting = true;
    this.error = '';

    this.api.submitAnswer(this.sessionId, this.question.session_question_id, this.selectedChoiceId).subscribe({
      next: response => {
        if (response.ended) {
          this.state.clear(this.sessionId);
          void this.router.navigate(['/results', this.sessionId]);
          return;
        }
        if (!response.next_question) {
          this.error = 'The server did not return the next question.';
          this.submitting = false;
          this.cdr.markForCheck();
          return;
        }
        this.question = response.next_question;
        this.state.saveQuestion(this.sessionId, response.next_question);
        this.selectedChoiceId = null;
        this.submitting = false;
        this.cdr.markForCheck();
      },
      error: err => {
        this.error = err?.error?.detail || 'Could not submit answer.';
        this.submitting = false;
        this.cdr.markForCheck();
      }
    });
  }
}
