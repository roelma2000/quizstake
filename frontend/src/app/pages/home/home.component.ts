import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';

import { ApiService } from '../../core/api.service';
import {
  PerformanceAnalysis,
  QuizHistoryItem,
  Topic,
  TopicPerformance,
  WeakQuestionPerformance
} from '../../core/models';
import { QuizStateService } from '../../core/quiz-state.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <section class="hero">
      <div>
        <p class="eyebrow">DASHBOARD</p>
        <h1>QuizStake</h1>
        <p class="muted">
          Start a quiz, review recent attempts, and focus on topics and questions that need more practice.
        </p>
      </div>
      <div class="hero-actions">
        <a routerLink="/performance" class="btn secondary link-btn">Performance</a>
        <a routerLink="/history" class="btn secondary link-btn">History</a>
      </div>
    </section>

    <p *ngIf="dashboardLoading" class="muted">Loading dashboard…</p>
    <p *ngIf="dashboardError" class="error">{{ dashboardError }}</p>

    <section *ngIf="!dashboardLoading" class="summary-grid">
      <article class="card stat-card">
        <span>Quiz attempts</span>
        <strong>{{ totalAttempts }}</strong>
      </article>
      <article class="card stat-card">
        <span>Questions answered</span>
        <strong>{{ totalAnswered }}</strong>
      </article>
      <article class="card stat-card">
        <span>Overall accuracy</span>
        <strong>{{ overallAccuracy }}%</strong>
      </article>
      <article class="card stat-card">
        <span>Total mistakes</span>
        <strong>{{ totalMistakes }}</strong>
      </article>
    </section>

    <section class="dashboard-grid">
      <section class="card setup">
        <div class="section-heading">
          <div>
            <p class="eyebrow">PRACTICE</p>
            <h2>Start a quiz</h2>
          </div>
        </div>

        <p *ngIf="topicsLoading">Loading topics…</p>
        <p *ngIf="quizError" class="error">{{ quizError }}</p>

        <ng-container *ngIf="!topicsLoading">
          <div class="field">
            <label for="topic">Topic / Module</label>
            <select id="topic" [(ngModel)]="selectedTopicId" (ngModelChange)="syncCountLimit()">
              <option [ngValue]="null">Select a topic</option>
              <option *ngFor="let topic of activeTopics" [ngValue]="topic.id">
                {{ topic.name }} — {{ topic.question_count }} questions
              </option>
            </select>
          </div>

          <div class="field">
            <label for="count">Number of questions</label>
            <input id="count" type="number" min="1" [max]="selectedMax" [(ngModel)]="questionCount">
            <small class="muted">Maximum for this selection: {{ selectedMax }}</small>
          </div>

          <button class="btn" [disabled]="starting || !selectedTopicId || selectedMax < 1" (click)="start()">
            {{ starting ? 'Starting…' : 'Start Quiz' }}
          </button>
        </ng-container>
      </section>

      <section class="card weak-summary">
        <div class="section-heading">
          <div>
            <p class="eyebrow">WEAK AREAS</p>
            <h2>Topics needing attention</h2>
          </div>
          <a routerLink="/performance" class="text-link">View performance</a>
        </div>

        <div *ngIf="weakestTopics.length; else noTopicPerformance" class="rank-list">
          <div *ngFor="let item of weakestTopics" class="rank-row">
            <div>
              <strong>{{ item.topic_name }}</strong>
              <span class="muted">{{ item.answered_questions }} answered</span>
            </div>
            <strong>{{ item.accuracy_percent }}%</strong>
          </div>
        </div>

        <ng-template #noTopicPerformance>
          <p class="muted">No finished quiz data yet.</p>
        </ng-template>

        <a *ngIf="weakQuestions.length" routerLink="/performance" class="btn link-btn">
          Practice Weak Questions
        </a>
      </section>
    </section>

    <section class="dashboard-grid lower-grid">
      <section class="card">
        <div class="section-heading">
          <div>
            <p class="eyebrow">RECENT</p>
            <h2>Quiz attempts</h2>
          </div>
          <a routerLink="/history" class="text-link">View all</a>
        </div>

        <div *ngIf="recentHistory.length; else noHistory" class="recent-list">
          <a
            *ngFor="let item of recentHistory"
            class="recent-row"
            [routerLink]="['/results', item.session_id]">
            <div>
              <strong>{{ item.topic_name }}</strong>
              <span class="muted">{{ item.started_at | date:'medium' }}</span>
            </div>
            <div class="recent-score">
              <strong>{{ item.score_percent }}%</strong>
              <span [class.terminated]="item.status === 'terminated'">
                {{ item.end_reason === 'mistake_limit' ? 'Mistake limit' : 'Completed' }}
              </span>
            </div>
          </a>
        </div>

        <ng-template #noHistory>
          <p class="muted">No finished quiz attempts yet.</p>
        </ng-template>
      </section>

      <section class="card">
        <div class="section-heading">
          <div>
            <p class="eyebrow">FREQUENTLY MISSED</p>
            <h2>Questions to revisit</h2>
          </div>
          <a routerLink="/performance" class="text-link">View all</a>
        </div>

        <div *ngIf="weakQuestions.length; else noWeakQuestions" class="question-list">
          <div *ngFor="let item of weakQuestions" class="question-row">
            <div>
              <span class="topic-pill">{{ item.topic_name }}</span>
              <strong>{{ item.prompt }}</strong>
            </div>
            <span class="miss-count">{{ item.incorrect_answers }} miss{{ item.incorrect_answers === 1 ? '' : 'es' }}</span>
          </div>
        </div>

        <ng-template #noWeakQuestions>
          <p class="muted">No missed questions yet.</p>
        </ng-template>
      </section>
    </section>
  `,
  styles: [`
    .hero { display:flex; justify-content:space-between; align-items:flex-end; gap:24px; margin-bottom:24px; }
    .hero h1 { font-size:clamp(34px, 5vw, 52px); line-height:1.05; margin:6px 0 10px; }
    .hero p { max-width:720px; }
    .hero-actions { display:flex; gap:10px; flex-wrap:wrap; }
    .eyebrow { margin:0; font-size:12px; letter-spacing:.14em; font-weight:800; color:#1f5eff; }
    .link-btn { text-decoration:none; display:inline-block; }
    .text-link { color:#1f5eff; text-decoration:none; font-weight:750; white-space:nowrap; }
    .summary-grid { display:grid; grid-template-columns:repeat(4, minmax(0, 1fr)); gap:14px; margin-bottom:18px; }
    .stat-card { display:grid; gap:7px; }
    .stat-card span { color:#667085; font-size:13px; font-weight:700; }
    .stat-card strong { font-size:30px; }
    .dashboard-grid { display:grid; grid-template-columns:minmax(0, 1.05fr) minmax(0, .95fr); gap:18px; margin-bottom:18px; }
    .lower-grid { align-items:start; }
    .setup, .weak-summary { display:grid; gap:18px; }
    .section-heading { display:flex; justify-content:space-between; align-items:flex-start; gap:16px; }
    .section-heading h2 { margin:4px 0 0; }
    small { display:block; }
    .rank-list, .recent-list, .question-list { display:grid; gap:10px; }
    .rank-row, .recent-row, .question-row { display:flex; justify-content:space-between; align-items:center; gap:16px; padding:12px 0; border-bottom:1px solid #eaecf0; }
    .rank-row:last-child, .recent-row:last-child, .question-row:last-child { border-bottom:0; }
    .rank-row > div, .recent-row > div:first-child, .question-row > div { display:grid; gap:4px; min-width:0; }
    .recent-row { color:inherit; text-decoration:none; }
    .recent-row:hover strong:first-child { color:#1f5eff; }
    .recent-score { display:grid; justify-items:end; gap:4px; }
    .recent-score span { border-radius:999px; padding:3px 8px; font-size:11px; font-weight:800; background:#ecfdf3; color:#027a48; }
    .recent-score span.terminated { background:#fef3f2; color:#b42318; }
    .topic-pill { width:max-content; max-width:100%; overflow:hidden; text-overflow:ellipsis; border-radius:999px; padding:3px 8px; font-size:11px; font-weight:800; background:#eff4ff; color:#3538cd; }
    .question-row strong { line-height:1.35; }
    .miss-count { flex:0 0 auto; border-radius:999px; padding:4px 9px; font-size:12px; font-weight:800; background:#fef3f2; color:#b42318; }
    @media (max-width:900px) {
      .summary-grid { grid-template-columns:1fr 1fr; }
      .dashboard-grid { grid-template-columns:1fr; }
    }
    @media (max-width:640px) {
      .hero, .section-heading { flex-direction:column; align-items:stretch; }
      .summary-grid { grid-template-columns:1fr 1fr; }
      .rank-row, .recent-row, .question-row { align-items:flex-start; }
    }
  `]
})
export class HomeComponent implements OnInit {
  topics: Topic[] = [];
  performance: PerformanceAnalysis | null = null;
  recentHistory: QuizHistoryItem[] = [];
  selectedTopicId: number | null = null;
  questionCount = 20;
  selectedMax = 100;
  topicsLoading = true;
  dashboardLoading = true;
  starting = false;
  quizError = '';
  dashboardError = '';

  constructor(
    private readonly api: ApiService,
    private readonly router: Router,
    private readonly state: QuizStateService,
    private readonly cdr: ChangeDetectorRef
  ) {}

  get activeTopics(): Topic[] {
    return this.topics.filter(topic => topic.active);
  }

  get totalAttempts(): number {
    return this.performance?.topics.reduce((sum, item) => sum + item.attempts, 0) ?? 0;
  }

  get totalAnswered(): number {
    return this.performance?.topics.reduce((sum, item) => sum + item.answered_questions, 0) ?? 0;
  }

  get totalCorrect(): number {
    return this.performance?.topics.reduce((sum, item) => sum + item.correct_answers, 0) ?? 0;
  }

  get totalMistakes(): number {
    return this.performance?.topics.reduce((sum, item) => sum + item.mistakes, 0) ?? 0;
  }

  get overallAccuracy(): number {
    return this.totalAnswered
      ? Math.round((this.totalCorrect / this.totalAnswered) * 10000) / 100
      : 0;
  }

  get weakestTopics(): TopicPerformance[] {
    return [...(this.performance?.topics ?? [])]
      .filter(item => item.answered_questions > 0)
      .sort((a, b) =>
        a.accuracy_percent - b.accuracy_percent ||
        b.mistakes - a.mistakes ||
        a.topic_name.localeCompare(b.topic_name)
      )
      .slice(0, 3);
  }

  get weakQuestions(): WeakQuestionPerformance[] {
    return (this.performance?.weak_questions ?? []).slice(0, 5);
  }

  ngOnInit(): void {
    forkJoin({
      topics: this.api.getTopics(),
      performance: this.api.getPerformance(null, 20),
      history: this.api.getQuizHistory(null, 5)
    }).subscribe({
      next: ({ topics, performance, history }) => {
        this.topics = topics;
        this.performance = performance;
        this.recentHistory = history;
        this.topicsLoading = false;
        this.dashboardLoading = false;
        this.cdr.markForCheck();
      },
      error: err => {
        this.dashboardError = err?.error?.detail || 'Could not load dashboard data.';
        this.topicsLoading = false;
        this.dashboardLoading = false;
        this.cdr.markForCheck();
      }
    });
  }

  syncCountLimit(): void {
    const topic = this.topics.find(item => item.id === this.selectedTopicId);
    this.selectedMax = topic
      ? Math.min(topic.max_questions, topic.question_count, 100)
      : 100;
    this.questionCount = Math.max(
      1,
      Math.min(this.questionCount, this.selectedMax || 1)
    );
  }

  start(): void {
    if (!this.selectedTopicId) return;

    this.starting = true;
    this.quizError = '';
    const count = Math.max(
      1,
      Math.min(this.questionCount, this.selectedMax)
    );

    this.api.startQuiz(this.selectedTopicId, count).subscribe({
      next: response => {
        this.state.saveQuestion(response.session_id, response.question);
        void this.router.navigate(['/quiz', response.session_id]);
      },
      error: err => {
        this.quizError = err?.error?.detail || 'Could not start quiz.';
        this.starting = false;
        this.cdr.markForCheck();
      }
    });
  }
}
