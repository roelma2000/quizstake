import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { ApiService } from '../../core/api.service';
import { Topic, TopicPayload } from '../../core/models';

interface TopicForm {
  name: string;
  description: string;
  mistake_limit: number;
  max_questions: number;
  active: boolean;
}

@Component({
  selector: 'app-topic-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="page-heading">
      <div>
        <p class="eyebrow">TOPICS / MODULES</p>
        <h1>Manage topics</h1>
        <p class="muted">Create modules and control quiz limits and availability.</p>
      </div>
      <button class="btn" (click)="newTopic()">New Topic</button>
    </section>

    <p *ngIf="loading" class="muted">Loading topics…</p>
    <p *ngIf="error" class="error">{{ error }}</p>

    <section *ngIf="editorOpen" class="card editor">
      <div class="editor-heading">
        <h2>{{ editingId ? 'Edit topic' : 'New topic' }}</h2>
        <button class="text-button" type="button" (click)="cancelEdit()">Cancel</button>
      </div>

      <div class="field">
        <label for="name">Topic / Module name</label>
        <input id="name" [(ngModel)]="form.name" maxlength="160">
      </div>

      <div class="field">
        <label for="description">Description</label>
        <textarea id="description" rows="3" [(ngModel)]="form.description"></textarea>
      </div>

      <div class="settings-grid">
        <div class="field">
          <label for="mistakeLimit">Mistake limit</label>
          <input id="mistakeLimit" type="number" min="1" max="100" [(ngModel)]="form.mistake_limit">
          <small class="muted">Quiz ends when this many mistakes are reached.</small>
        </div>

        <div class="field">
          <label for="maxQuestions">Maximum questions</label>
          <input id="maxQuestions" type="number" min="1" max="100" [(ngModel)]="form.max_questions">
          <small class="muted">Maximum number of questions selectable for this topic.</small>
        </div>
      </div>

      <label class="active-check">
        <input type="checkbox" [(ngModel)]="form.active">
        Active and available for quizzes
      </label>

      <p *ngIf="editorError" class="error">{{ editorError }}</p>

      <div class="actions">
        <button class="btn" [disabled]="saving" (click)="save()">
          {{ saving ? 'Saving…' : 'Save Topic' }}
        </button>
        <button class="btn secondary" type="button" (click)="cancelEdit()">Cancel</button>
      </div>
    </section>

    <section *ngIf="!loading && !topics.length" class="card empty">
      No topics have been created yet.
    </section>

    <section class="topic-list">
      <article class="card topic-card" *ngFor="let topic of topics">
        <div class="topic-heading">
          <div>
            <div class="meta">
              <span>{{ topic.question_count }} active question{{ topic.question_count === 1 ? '' : 's' }}</span>
              <span [class.inactive]="!topic.active">{{ topic.active ? 'Active' : 'Inactive' }}</span>
            </div>
            <h2>{{ topic.name }}</h2>
          </div>

          <div class="row-actions">
            <button class="btn secondary" (click)="edit(topic)">Edit</button>
            <button class="btn secondary" (click)="toggleActive(topic)">
              {{ topic.active ? 'Deactivate' : 'Activate' }}
            </button>
            <button class="danger-button" (click)="remove(topic)">Delete</button>
          </div>
        </div>

        <p *ngIf="topic.description; else noDescription" class="description">{{ topic.description }}</p>
        <ng-template #noDescription>
          <p class="description muted">No description.</p>
        </ng-template>

        <div class="settings">
          <div>
            <span class="setting-label">Mistake limit</span>
            <strong>{{ topic.mistake_limit }}</strong>
          </div>
          <div>
            <span class="setting-label">Maximum questions</span>
            <strong>{{ topic.max_questions }}</strong>
          </div>
        </div>
      </article>
    </section>
  `,
  styles: [`
    .page-heading { display:flex; justify-content:space-between; align-items:flex-start; gap:24px; margin-bottom:22px; }
    .page-heading h1 { margin:4px 0 8px; font-size:36px; }
    .eyebrow { margin:0; font-size:12px; letter-spacing:.14em; font-weight:800; color:#1f5eff; }
    .editor { display:grid; gap:18px; margin-bottom:24px; }
    .editor-heading, .topic-heading, .actions, .row-actions { display:flex; gap:10px; align-items:center; }
    .editor-heading, .topic-heading { justify-content:space-between; align-items:flex-start; }
    .editor-heading h2, .topic-heading h2 { margin:0; }
    textarea { width:100%; border:1px solid #cbd3df; border-radius:9px; padding:10px 12px; resize:vertical; font:inherit; }
    .settings-grid { display:grid; grid-template-columns:1fr 1fr; gap:16px; }
    .active-check { display:flex; align-items:center; gap:8px; font-weight:650; }
    .text-button, .danger-button { border:0; background:transparent; font:inherit; font-weight:700; cursor:pointer; }
    .text-button { color:#475467; }
    .danger-button { color:#b42318; padding:10px 8px; }
    .topic-list { display:grid; gap:16px; }
    .topic-card { display:grid; gap:16px; }
    .topic-heading { gap:24px; }
    .topic-heading h2 { margin-top:8px; font-size:22px; }
    .meta { display:flex; gap:8px; flex-wrap:wrap; }
    .meta span { display:inline-block; border-radius:999px; background:#eff4ff; color:#3538cd; padding:4px 9px; font-size:12px; font-weight:800; }
    .meta span:last-child { background:#ecfdf3; color:#027a48; }
    .meta span.inactive { background:#f2f4f7; color:#667085; }
    .description { margin:0; }
    .settings { display:grid; grid-template-columns:repeat(2, minmax(0, 1fr)); gap:12px; }
    .settings > div { display:grid; gap:4px; padding:12px 14px; border-radius:10px; background:#f8fafc; }
    .setting-label { font-size:12px; font-weight:800; text-transform:uppercase; color:#667085; }
    .settings strong { font-size:20px; }
    .empty { text-align:center; color:#667085; }
    @media (max-width:760px) {
      .page-heading, .topic-heading { flex-direction:column; align-items:stretch; }
      .settings-grid, .settings { grid-template-columns:1fr; }
      .row-actions { flex-wrap:wrap; }
    }
  `]
})
export class TopicManagementComponent implements OnInit {
  topics: Topic[] = [];
  loading = true;
  saving = false;
  editorOpen = false;
  editingId: number | null = null;
  error = '';
  editorError = '';
  form: TopicForm = this.emptyForm();

  constructor(
    private readonly api: ApiService,
    private readonly cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadTopics();
  }

  loadTopics(): void {
    this.loading = true;
    this.error = '';
    this.api.getTopics().subscribe({
      next: topics => {
        this.topics = topics;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: err => {
        this.error = this.errorMessage(err, 'Could not load topics.');
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  newTopic(): void {
    this.editingId = null;
    this.form = this.emptyForm();
    this.editorError = '';
    this.editorOpen = true;
  }

  edit(topic: Topic): void {
    this.editingId = topic.id;
    this.form = {
      name: topic.name,
      description: topic.description ?? '',
      mistake_limit: topic.mistake_limit,
      max_questions: topic.max_questions,
      active: topic.active
    };
    this.editorError = '';
    this.editorOpen = true;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  cancelEdit(): void {
    this.editingId = null;
    this.form = this.emptyForm();
    this.editorError = '';
    this.editorOpen = false;
  }

  save(): void {
    const payload = this.buildPayload();
    if (!payload) return;

    this.saving = true;
    this.editorError = '';

    const request = this.editingId
      ? this.api.updateTopic(this.editingId, payload)
      : this.api.createTopic(payload);

    request.subscribe({
      next: () => {
        this.saving = false;
        this.cancelEdit();
        this.loadTopics();
      },
      error: err => {
        this.editorError = this.errorMessage(err, 'Could not save topic.');
        this.saving = false;
        this.cdr.markForCheck();
      }
    });
  }

  toggleActive(topic: Topic): void {
    this.error = '';
    this.api.updateTopic(topic.id, { active: !topic.active }).subscribe({
      next: updated => {
        const index = this.topics.findIndex(item => item.id === updated.id);
        if (index >= 0) this.topics[index] = updated;
        this.cdr.markForCheck();
      },
      error: err => {
        this.error = this.errorMessage(err, 'Could not update topic.');
        this.cdr.markForCheck();
      }
    });
  }

  remove(topic: Topic): void {
    if (!window.confirm(`Delete "${topic.name}"? This cannot be undone.`)) return;

    this.error = '';
    this.api.deleteTopic(topic.id).subscribe({
      next: () => {
        this.topics = this.topics.filter(item => item.id !== topic.id);
        this.cdr.markForCheck();
      },
      error: err => {
        this.error = this.errorMessage(err, 'Could not delete topic.');
        this.cdr.markForCheck();
      }
    });
  }

  private emptyForm(): TopicForm {
    return {
      name: '',
      description: '',
      mistake_limit: 5,
      max_questions: 100,
      active: true
    };
  }

  private buildPayload(): TopicPayload | null {
    const name = this.form.name.trim();
    if (!name) {
      this.editorError = 'Topic name is required.';
      return null;
    }

    const mistakeLimit = Number(this.form.mistake_limit);
    const maxQuestions = Number(this.form.max_questions);

    if (!Number.isInteger(mistakeLimit) || mistakeLimit < 1 || mistakeLimit > 100) {
      this.editorError = 'Mistake limit must be a whole number from 1 to 100.';
      return null;
    }

    if (!Number.isInteger(maxQuestions) || maxQuestions < 1 || maxQuestions > 100) {
      this.editorError = 'Maximum questions must be a whole number from 1 to 100.';
      return null;
    }

    return {
      name,
      description: this.form.description.trim() || null,
      mistake_limit: mistakeLimit,
      max_questions: maxQuestions,
      active: this.form.active
    };
  }

  private errorMessage(err: any, fallback: string): string {
    const detail = err?.error?.detail;
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail) && detail.length) {
      return detail.map(item => item?.msg || 'Invalid value').join('; ');
    }
    return fallback;
  }
}
