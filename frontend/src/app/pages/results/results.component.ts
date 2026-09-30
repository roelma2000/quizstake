import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { QuizResult } from '../../core/models';

@Component({
  selector: 'app-results',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <section *ngIf="result" class="results">
      <div class="card summary">
        <p class="eyebrow">QUIZ RESULTS</p>
        <h1>{{ result.score_percent }}%</h1>
        <p>
          {{ result.correct_answers }} correct out of {{ result.answered_questions }} answered.
          <span *ngIf="result.end_reason === 'mistake_limit'">The session ended because the configured mistake limit was reached.</span>
        </p>
        <a routerLink="/" class="btn link-btn">Start another quiz</a>
      </div>

      <h2>Review</h2>
      <article *ngFor="let item of result.review" class="card review" [class.wrong]="!item.correct">
        <div class="review-head">
          <strong>Question {{ item.number }}</strong>
          <span [class.ok]="item.correct" [class.bad]="!item.correct">{{ item.correct ? 'Correct' : 'Incorrect' }}</span>
        </div>
        <h3>{{ item.prompt }}</h3>
        <p><strong>Your answer:</strong> {{ item.selected_answer }}</p>
        <p *ngIf="!item.correct"><strong>Correct answer:</strong> {{ item.correct_answer }}</p>
        <p *ngIf="item.explanation" class="muted">{{ item.explanation }}</p>
      </article>
    </section>
    <section *ngIf="error" class="card error">{{ error }}</section>
  `,
  styles: [`
    .results { max-width:860px; margin:0 auto; }
    .summary { text-align:center; margin-bottom:28px; }
    .eyebrow { font-size:12px; letter-spacing:.14em; font-weight:800; color:#1f5eff; }
    .summary h1 { margin:6px 0; font-size:64px; }
    .link-btn { display:inline-block; margin-top:12px; text-decoration:none; }
    .review { margin:12px 0; border-left:5px solid #12b76a; }
    .review.wrong { border-left-color:#f04438; }
    .review-head { display:flex; justify-content:space-between; }
    .ok { color:#027a48; font-weight:800; }
    .bad { color:#b42318; font-weight:800; }
    h3 { margin-bottom:16px; }
  `]
})
export class ResultsComponent implements OnInit {
  result: QuizResult | null = null;
  error = '';

  constructor(private readonly route: ActivatedRoute, private readonly api: ApiService) {}

  ngOnInit(): void {
    const sessionId = Number(this.route.snapshot.paramMap.get('sessionId'));
    this.api.getResults(sessionId).subscribe({
      next: result => this.result = result,
      error: err => this.error = err?.error?.detail || 'Could not load quiz results.'
    });
  }
}
