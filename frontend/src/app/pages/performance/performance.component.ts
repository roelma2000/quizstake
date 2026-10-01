import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { ApiService } from '../../core/api.service';
import {
  PerformanceAnalysis,
  Topic,
  TopicPerformance,
  WeakQuestionPerformance
} from '../../core/models';

@Component({
  selector: 'app-performance',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <section class="page-heading">
      <div>
        <p class="eyebrow">PERFORMANCE</p>
        <h1>Progress and weak areas</h1>
        <p class="muted">Analyze finished quiz attempts and identify questions that need more practice.</p>
      </div>
    </section>

    <section class="card filters">
      <div class="field">
        <label for="performanceTopic">Topic / Module</label>
        <select
          id="performanceTopic"
          [(ngModel)]="selectedTopicId"
          (ngModelChange)="loadPerformance()">
          <option [ngValue]="null">All topics</option>
          <option *ngFor="let topic of topics" [ngValue]="topic.id">{{ topic.name }}</option>
        </select>
      </div>
    </section>

    <p *ngIf="loading" class="muted">Loading performance data…</p>
    <p *ngIf="error" class="error">{{ error }}</p>

    <ng-container *ngIf="!loading && data">
      <section *ngIf="data.topics.length; else noPerformance" class="topic-grid">
        <article class="card topic-card" *ngFor="let item of data.topics">
          <div class="topic-heading">
            <h2>{{ item.topic_name }}</h2>
            <strong class="accuracy">{{ item.accuracy_percent }}%</strong>
          </div>
          <div class="stats">
            <div><span>Attempts</span><strong>{{ item.attempts }}</strong></div>
            <div><span>Answered</span><strong>{{ item.answered_questions }}</strong></div>
            <div><span>Correct</span><strong>{{ item.correct_answers }}</strong></div>
            <div><span>Mistakes</span><strong>{{ item.mistakes }}</strong></div>
          </div>
        </article>
      </section>

      <ng-template #noPerformance>
        <section class="card empty">No finished quiz data found for this selection.</section>
      </ng-template>

      <section class="weak-section">
        <div class="section-heading">
          <div>
            <p class="eyebrow">WEAK QUESTIONS</p>
            <h2>Frequently missed</h2>
          </div>
          <span class="muted">{{ data.weak_questions.length }} shown</span>
        </div>

        <section *ngIf="!data.weak_questions.length" class="card empty">
          No missed questions found for this selection.
        </section>

        <article class="card weak-card" *ngFor="let item of data.weak_questions">
          <div class="weak-heading">
            <div>
              <div class="meta">
                <span>{{ item.topic_name }}</span>
                <span>{{ item.incorrect_answers }} miss{{ item.incorrect_answers === 1 ? '' : 'es' }}</span>
              </div>
              <h3>{{ item.prompt }}</h3>
            </div>
            <a
              class="btn secondary link-btn"
              [routerLink]="['/questions']"
              [queryParams]="{ topicId: item.topic_id, questionId: item.question_id }">
              Open Question
            </a>
          </div>

          <div class="stats weak-stats">
            <div><span>Attempts</span><strong>{{ item.attempts }}</strong></div>
            <div><span>Correct</span><strong>{{ item.correct_answers }}</strong></div>
            <div><span>Incorrect</span><strong>{{ item.incorrect_answers }}</strong></div>
            <div><span>Accuracy</span><strong>{{ item.accuracy_percent }}%</strong></div>
          </div>

          <p *ngIf="item.last_answered_at" class="muted last-answer">
            Last answered {{ item.last_answered_at | date:'medium' }}
          </p>
        </article>
      </section>
    </ng-container>
  `,
  styles: [`
    .page-heading { margin-bottom:22px; }
    .page-heading h1 { margin:4px 0 8px; font-size:36px; }
    .eyebrow { margin:0; font-size:12px; letter-spacing:.14em; font-weight:800; color:#1f5eff; }
    .filters { margin-bottom:22px; }
    .filters .field { width:min(420px, 100%); }
    .topic-grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(300px, 1fr)); gap:16px; }
    .topic-card { display:grid; gap:16px; }
    .topic-heading, .section-heading, .weak-heading { display:flex; justify-content:space-between; align-items:flex-start; gap:20px; }
    .topic-heading h2, .section-heading h2, .weak-heading h3 { margin:0; }
    .accuracy { font-size:28px; }
    .stats { display:grid; grid-template-columns:repeat(4, minmax(0, 1fr)); gap:10px; }
    .stats > div { display:grid; gap:4px; padding:11px 12px; border-radius:10px; background:#f8fafc; }
    .stats span { font-size:11px; font-weight:800; text-transform:uppercase; color:#667085; }
    .stats strong { font-size:19px; }
    .weak-section { margin-top:32px; display:grid; gap:14px; }
    .section-heading { align-items:end; }
    .weak-card { display:grid; gap:16px; }
    .weak-heading h3 { margin-top:8px; font-size:18px; line-height:1.4; }
    .meta { display:flex; gap:8px; flex-wrap:wrap; }
    .meta span { border-radius:999px; padding:4px 9px; font-size:12px; font-weight:800; background:#eff4ff; color:#3538cd; }
    .meta span:last-child { background:#fef3f2; color:#b42318; }
    .link-btn { text-decoration:none; white-space:nowrap; }
    .last-answer { margin:0; font-size:13px; }
    .empty { text-align:center; color:#667085; }
    @media (max-width:760px) {
      .topic-heading, .section-heading, .weak-heading { flex-direction:column; align-items:stretch; }
      .stats { grid-template-columns:1fr 1fr; }
    }
  `]
})
export class PerformanceComponent implements OnInit {
  topics: Topic[] = [];
  data: PerformanceAnalysis | null = null;
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

    this.loadPerformance();
  }

  loadPerformance(): void {
    this.loading = true;
    this.error = '';

    this.api.getPerformance(this.selectedTopicId).subscribe({
      next: data => {
        this.data = data;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: err => {
        this.error = err?.error?.detail || 'Could not load performance data.';
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }
}
