import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { Topic } from '../../core/models';
import { QuizStateService } from '../../core/quiz-state.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="hero">
      <p class="eyebrow">PURE RANDOM PRACTICE</p>
      <h1>Train recall without learning the answer position.</h1>
      <p class="muted">Questions are sampled only from your selected topic. Answer wording and answer order can change every session.</p>
    </section>

    <section class="card setup">
      <h2>Start a quiz</h2>
      <p *ngIf="loading">Loading topics…</p>
      <p *ngIf="error" class="error">{{ error }}</p>

      <ng-container *ngIf="!loading">
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
  `,
  styles: [`
    .hero { margin-bottom:24px; max-width:760px; }
    .eyebrow { font-size:12px; letter-spacing:.14em; font-weight:800; color:#1f5eff; }
    h1 { font-size:clamp(32px, 5vw, 54px); line-height:1.04; margin:8px 0 14px; }
    .setup { display:grid; gap:18px; max-width:620px; }
    .setup h2 { margin:0; }
    small { display:block; }
  `]
})
export class HomeComponent implements OnInit {
  topics: Topic[] = [];
  selectedTopicId: number | null = null;
  questionCount = 20;
  selectedMax = 100;
  loading = true;
  starting = false;
  error = '';

  constructor(
    private readonly api: ApiService,
    private readonly router: Router,
    private readonly state: QuizStateService
  ) {}

  get activeTopics(): Topic[] { return this.topics.filter(t => t.active); }

  ngOnInit(): void {
    this.api.getTopics().subscribe({
      next: topics => { this.topics = topics; this.loading = false; },
      error: err => { this.error = err?.error?.detail || 'Could not load topics.'; this.loading = false; }
    });
  }

  syncCountLimit(): void {
    const topic = this.topics.find(t => t.id === this.selectedTopicId);
    this.selectedMax = topic ? Math.min(topic.max_questions, topic.question_count, 100) : 100;
    this.questionCount = Math.max(1, Math.min(this.questionCount, this.selectedMax || 1));
  }

  start(): void {
    if (!this.selectedTopicId) return;
    this.starting = true;
    this.error = '';
    const count = Math.max(1, Math.min(this.questionCount, this.selectedMax));
    this.api.startQuiz(this.selectedTopicId, count).subscribe({
      next: response => {
        this.state.saveQuestion(response.session_id, response.question);
        void this.router.navigate(['/quiz', response.session_id]);
      },
      error: err => {
        this.error = err?.error?.detail || 'Could not start quiz.';
        this.starting = false;
      }
    });
  }
}
