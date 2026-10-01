import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { ApiService } from '../../core/api.service';
import { QuizHistoryItem, Topic } from '../../core/models';

@Component({
  selector: 'app-history',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <section class="page-heading">
      <div>
        <p class="eyebrow">QUIZ HISTORY</p>
        <h1>Previous attempts</h1>
        <p class="muted">Review completed and mistake-limit-ended quiz sessions.</p>
      </div>
    </section>

    <section class="card filters">
      <div class="field">
        <label for="historyTopic">Topic / Module</label>
        <select
          id="historyTopic"
          [(ngModel)]="selectedTopicId"
          (ngModelChange)="loadHistory()">
          <option [ngValue]="null">All topics</option>
          <option *ngFor="let topic of topics" [ngValue]="topic.id">{{ topic.name }}</option>
        </select>
      </div>
      <div class="count muted">
        {{ history.length }} attempt{{ history.length === 1 ? '' : 's' }}
      </div>
    </section>

    <p *ngIf="loading" class="muted">Loading quiz history…</p>
    <p *ngIf="error" class="error">{{ error }}</p>

    <section *ngIf="!loading && !history.length" class="card empty">
      No finished quiz attempts found for this selection.
    </section>

    <section class="history-list" *ngIf="history.length">
      <article class="card history-card" *ngFor="let item of history">
        <div class="history-heading">
          <div>
            <div class="meta">
              <span>{{ item.topic_name }}</span>
              <span [class.terminated]="item.status === 'terminated'">
                {{ statusLabel(item) }}
              </span>
            </div>
            <h2>{{ item.started_at | date:'medium' }}</h2>
          </div>

          <a class="btn secondary link-btn" [routerLink]="['/results', item.session_id]">
            View Results
          </a>
        </div>

        <div class="stats">
          <div>
            <span class="stat-label">Score</span>
            <strong>{{ item.score_percent }}%</strong>
          </div>
          <div>
            <span class="stat-label">Answered</span>
            <strong>{{ item.answered_questions }} / {{ item.total_questions }}</strong>
          </div>
          <div>
            <span class="stat-label">Correct</span>
            <strong>{{ item.correct_answers }}</strong>
          </div>
          <div>
            <span class="stat-label">Mistakes</span>
            <strong>{{ item.mistakes }}</strong>
          </div>
        </div>

        <p *ngIf="item.ended_at" class="ended muted">
          Ended {{ item.ended_at | date:'medium' }}
        </p>
      </article>
    </section>
  `,
  styles: [`
    .page-heading { margin-bottom:22px; }
    .page-heading h1 { margin:4px 0 8px; font-size:36px; }
    .eyebrow { margin:0; font-size:12px; letter-spacing:.14em; font-weight:800; color:#1f5eff; }
    .filters { display:flex; align-items:end; justify-content:space-between; gap:24px; margin-bottom:22px; }
    .filters .field { width:min(420px, 100%); }
    .count { padding-bottom:10px; }
    .history-list { display:grid; gap:16px; }
    .history-card { display:grid; gap:16px; }
    .history-heading { display:flex; align-items:flex-start; justify-content:space-between; gap:20px; }
    .history-heading h2 { margin:8px 0 0; font-size:20px; }
    .meta { display:flex; gap:8px; flex-wrap:wrap; }
    .meta span { display:inline-block; border-radius:999px; padding:4px 9px; font-size:12px; font-weight:800; background:#eff4ff; color:#3538cd; }
    .meta span:last-child { background:#ecfdf3; color:#027a48; }
    .meta span.terminated { background:#fef3f2; color:#b42318; }
    .stats { display:grid; grid-template-columns:repeat(4, minmax(0, 1fr)); gap:12px; }
    .stats > div { display:grid; gap:4px; padding:12px 14px; border-radius:10px; background:#f8fafc; }
    .stat-label { font-size:12px; font-weight:800; text-transform:uppercase; color:#667085; }
    .stats strong { font-size:20px; }
    .link-btn { text-decoration:none; white-space:nowrap; }
    .ended { margin:0; font-size:13px; }
    .empty { text-align:center; color:#667085; }
    @media (max-width:760px) {
      .filters, .history-heading { flex-direction:column; align-items:stretch; }
      .stats { grid-template-columns:1fr 1fr; }
    }
  `]
})
export class HistoryComponent implements OnInit {
  topics: Topic[] = [];
  history: QuizHistoryItem[] = [];
  selectedTopicId: number | null = null;
  loading = true;
  error = '';

  constructor(
    private readonly api: ApiService,
    private readonly cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.api.getTopics().subscribe({
      next: topics => {
        this.topics = topics;
        this.cdr.markForCheck();
      },
      error: () => {
        this.cdr.markForCheck();
      }
    });

    this.loadHistory();
  }

  loadHistory(): void {
    this.loading = true;
    this.error = '';

    this.api.getQuizHistory(this.selectedTopicId).subscribe({
      next: history => {
        this.history = history;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: err => {
        this.error = err?.error?.detail || 'Could not load quiz history.';
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  statusLabel(item: QuizHistoryItem): string {
    if (item.end_reason === 'mistake_limit') return 'Mistake limit';
    if (item.status === 'completed') return 'Completed';
    return item.status;
  }
}
