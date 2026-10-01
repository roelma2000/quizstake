import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { ApiService } from '../../core/api.service';
import {
  AdminQuestion,
  QuestionChoiceInput,
  QuestionPayload,
  Topic
} from '../../core/models';

interface ChoiceForm {
  text: string;
  alternatives: string;
  is_correct: boolean;
}

interface QuestionForm {
  topic_id: number | null;
  prompt: string;
  explanation: string;
  active: boolean;
  choices: ChoiceForm[];
}

@Component({
  selector: 'app-question-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="page-heading">
      <div>
        <p class="eyebrow">QUESTION BANK</p>
        <h1>Manage questions</h1>
        <p class="muted">Create and maintain questions, answer choices, alternative wording, and availability.</p>
      </div>
      <button class="btn" (click)="newQuestion()">New Question</button>
    </section>

    <section class="card filters">
      <div class="field">
        <label for="topicFilter">Topic / Module</label>
        <select id="topicFilter" [(ngModel)]="selectedTopicId" (ngModelChange)="loadQuestions()">
          <option [ngValue]="null">All topics</option>
          <option *ngFor="let topic of topics" [ngValue]="topic.id">{{ topic.name }}</option>
        </select>
      </div>
      <div class="count muted">{{ questions.length }} question{{ questions.length === 1 ? '' : 's' }}</div>
    </section>

    <p *ngIf="loading" class="muted">Loading questions…</p>
    <p *ngIf="error" class="error">{{ error }}</p>

    <section *ngIf="editorOpen" class="card editor">
      <div class="editor-heading">
        <h2>{{ editingId ? 'Edit question' : 'New question' }}</h2>
        <button class="text-button" type="button" (click)="cancelEdit()">Cancel</button>
      </div>

      <div class="field">
        <label for="editTopic">Topic / Module</label>
        <select id="editTopic" [(ngModel)]="form.topic_id">
          <option [ngValue]="null">Select a topic</option>
          <option *ngFor="let topic of topics" [ngValue]="topic.id">{{ topic.name }}</option>
        </select>
      </div>

      <div class="field">
        <label for="prompt">Question</label>
        <textarea id="prompt" rows="3" [(ngModel)]="form.prompt"></textarea>
      </div>

      <div class="field">
        <label for="explanation">Explanation</label>
        <textarea id="explanation" rows="3" [(ngModel)]="form.explanation"></textarea>
      </div>

      <div class="answers">
        <h3>Answer choices</h3>
        <p class="muted">Exactly one answer must be marked correct. Put alternative wording on separate lines.</p>

        <div class="answer-row" *ngFor="let choice of form.choices; let i = index">
          <div class="answer-number">{{ i + 1 }}</div>
          <div class="answer-fields">
            <div class="field">
              <label [for]="'answer-' + i">Answer text</label>
              <input [id]="'answer-' + i" [(ngModel)]="choice.text">
            </div>
            <div class="field">
              <label [for]="'alternatives-' + i">Alternative wording</label>
              <textarea
                [id]="'alternatives-' + i"
                rows="2"
                [(ngModel)]="choice.alternatives"
                placeholder="One alternative per line"></textarea>
            </div>
          </div>
          <label class="correct-choice">
            <input
              type="radio"
              name="correctChoice"
              [checked]="choice.is_correct"
              (change)="setCorrect(i)">
            Correct
          </label>
        </div>
      </div>

      <label class="active-check">
        <input type="checkbox" [(ngModel)]="form.active">
        Active and available for quizzes
      </label>

      <p *ngIf="editorError" class="error">{{ editorError }}</p>

      <div class="actions">
        <button class="btn" [disabled]="saving" (click)="save()">
          {{ saving ? 'Saving…' : 'Save Question' }}
        </button>
        <button class="btn secondary" type="button" (click)="cancelEdit()">Cancel</button>
      </div>
    </section>

    <section *ngIf="!loading && !questions.length" class="card empty">
      No questions found for this selection.
    </section>

    <section class="question-list">
      <article class="card question-card" *ngFor="let question of questions">
        <div class="question-heading">
          <div>
            <div class="meta">
              <span>{{ question.topic_name }}</span>
              <span [class.inactive]="!question.active">
                {{ question.active ? 'Active' : 'Inactive' }}
              </span>
            </div>
            <h2>{{ question.prompt }}</h2>
          </div>
          <div class="row-actions">
            <button class="btn secondary" (click)="edit(question)">Edit</button>
            <button class="btn secondary" (click)="toggleActive(question)">
              {{ question.active ? 'Deactivate' : 'Activate' }}
            </button>
            <button class="danger-button" (click)="remove(question)">Delete</button>
          </div>
        </div>

        <p *ngIf="question.explanation" class="explanation">
          <strong>Explanation:</strong> {{ question.explanation }}
        </p>

        <ol class="choice-list">
          <li *ngFor="let choice of question.choices" [class.correct]="choice.is_correct">
            <div>
              <strong>{{ choice.text }}</strong>
              <span *ngIf="choice.is_correct" class="correct-label">Correct</span>
            </div>
            <div class="alternative-block">
              <div class="alternative-title">Alternative answers</div>
              <ul *ngIf="choice.alternatives.length; else noAlternatives" class="alternative-list">
                <li *ngFor="let alternative of choice.alternatives">{{ alternative }}</li>
              </ul>
              <ng-template #noAlternatives>
                <div class="no-alternatives">None</div>
              </ng-template>
            </div>
          </li>
        </ol>
      </article>
    </section>
  `,
  styles: [`
    .page-heading { display:flex; justify-content:space-between; align-items:flex-start; gap:24px; margin-bottom:22px; }
    .page-heading h1 { margin:4px 0 8px; font-size:36px; }
    .eyebrow { margin:0; font-size:12px; letter-spacing:.14em; font-weight:800; color:#1f5eff; }
    .filters { display:flex; align-items:end; justify-content:space-between; gap:24px; margin-bottom:22px; }
    .filters .field { width:min(420px, 100%); }
    .count { padding-bottom:10px; }
    .editor { display:grid; gap:18px; margin-bottom:24px; }
    .editor-heading, .question-heading, .actions, .row-actions { display:flex; align-items:center; gap:10px; }
    .editor-heading, .question-heading { justify-content:space-between; align-items:flex-start; }
    .editor-heading h2, .question-heading h2 { margin:0; }
    textarea { width:100%; border:1px solid #cbd3df; border-radius:9px; padding:10px 12px; resize:vertical; font:inherit; }
    .answers { display:grid; gap:12px; }
    .answers h3 { margin:0; }
    .answers > p { margin:0; }
    .answer-row { display:grid; grid-template-columns:36px 1fr auto; gap:14px; align-items:start; padding:14px; border:1px solid #e1e6ee; border-radius:12px; }
    .answer-number { width:30px; height:30px; display:grid; place-items:center; border-radius:50%; background:#eef2f8; font-weight:800; }
    .answer-fields { display:grid; gap:12px; }
    .correct-choice, .active-check { display:flex; align-items:center; gap:8px; font-weight:650; }
    .correct-choice { padding-top:31px; }
    .text-button, .danger-button { border:0; background:transparent; font:inherit; font-weight:700; cursor:pointer; }
    .text-button { color:#475467; }
    .danger-button { color:#b42318; padding:10px 8px; }
    .question-list { display:grid; gap:16px; }
    .question-card { display:grid; gap:16px; }
    .question-heading { gap:24px; }
    .question-heading h2 { margin-top:8px; font-size:20px; line-height:1.35; }
    .meta { display:flex; gap:8px; flex-wrap:wrap; }
    .meta span { display:inline-block; border-radius:999px; background:#ecfdf3; color:#027a48; padding:4px 9px; font-size:12px; font-weight:800; }
    .meta span:first-child { background:#eff4ff; color:#3538cd; }
    .meta span.inactive { background:#f2f4f7; color:#667085; }
    .explanation { margin:0; padding:12px 14px; background:#f8fafc; border-radius:10px; }
    .choice-list { margin:0; padding-left:24px; display:grid; gap:10px; }
    .choice-list li { padding:10px 12px; border:1px solid #e4e7ec; border-radius:9px; }
    .choice-list li.correct { border-color:#abefc6; background:#ecfdf3; }
    .correct-label { margin-left:8px; color:#027a48; font-size:12px; text-transform:uppercase; }
    .alternative-block { margin-top:8px; padding:9px 11px; border-radius:8px; background:#f8fafc; }
    .alternative-title { font-size:12px; font-weight:800; text-transform:uppercase; letter-spacing:.04em; color:#475467; margin-bottom:5px; }
    .alternative-list { margin:0; padding-left:20px; display:grid; gap:3px; color:#475467; font-size:13px; }
    .no-alternatives { color:#98a2b3; font-size:13px; font-style:italic; }
    .empty { text-align:center; color:#667085; }
    @media (max-width: 760px) {
      .page-heading, .filters, .question-heading { flex-direction:column; align-items:stretch; }
      .row-actions { flex-wrap:wrap; }
      .answer-row { grid-template-columns:36px 1fr; }
      .correct-choice { grid-column:2; padding-top:0; }
    }
  `]
})
export class QuestionManagementComponent implements OnInit {
  topics: Topic[] = [];
  questions: AdminQuestion[] = [];
  selectedTopicId: number | null = null;
  loading = true;
  saving = false;
  editorOpen = false;
  editingId: number | null = null;
  error = '';
  editorError = '';
  form: QuestionForm = this.emptyForm();

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
      error: err => {
        this.error = err?.error?.detail || 'Could not load topics.';
        this.cdr.markForCheck();
      }
    });
    this.loadQuestions();
  }

  loadQuestions(): void {
    this.loading = true;
    this.error = '';
    this.api.getQuestions(this.selectedTopicId).subscribe({
      next: questions => {
        this.questions = questions;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: err => {
        this.error = err?.error?.detail || 'Could not load questions.';
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  newQuestion(): void {
    this.editingId = null;
    this.form = this.emptyForm(this.selectedTopicId);
    this.editorError = '';
    this.editorOpen = true;
  }

  edit(question: AdminQuestion): void {
    this.editingId = question.id;
    this.form = {
      topic_id: question.topic_id,
      prompt: question.prompt,
      explanation: question.explanation ?? '',
      active: question.active,
      choices: question.choices.map(choice => ({
        text: choice.text,
        alternatives: choice.alternatives.join('\n'),
        is_correct: choice.is_correct
      }))
    };
    this.editorError = '';
    this.editorOpen = true;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  cancelEdit(): void {
    this.editorOpen = false;
    this.editingId = null;
    this.editorError = '';
    this.form = this.emptyForm(this.selectedTopicId);
  }

  setCorrect(index: number): void {
    this.form.choices.forEach((choice, choiceIndex) => {
      choice.is_correct = choiceIndex === index;
    });
  }

  save(): void {
    const payload = this.buildPayload();
    if (!payload) return;

    this.saving = true;
    this.editorError = '';
    const request = this.editingId
      ? this.api.updateQuestion(this.editingId, payload)
      : this.api.createQuestion(payload);

    request.subscribe({
      next: () => {
        this.saving = false;
        this.cancelEdit();
        this.loadQuestions();
      },
      error: err => {
        this.editorError = this.errorMessage(err, 'Could not save question.');
        this.saving = false;
        this.cdr.markForCheck();
      }
    });
  }

  toggleActive(question: AdminQuestion): void {
    this.api.updateQuestion(question.id, { active: !question.active }).subscribe({
      next: updated => {
        const index = this.questions.findIndex(item => item.id === updated.id);
        if (index >= 0) this.questions[index] = updated;
        this.cdr.markForCheck();
      },
      error: err => {
        this.error = this.errorMessage(err, 'Could not update question.');
        this.cdr.markForCheck();
      }
    });
  }

  remove(question: AdminQuestion): void {
    if (!window.confirm('Delete this question? This cannot be undone.')) return;
    this.error = '';
    this.api.deleteQuestion(question.id).subscribe({
      next: () => {
        this.questions = this.questions.filter(item => item.id !== question.id);
        this.cdr.markForCheck();
      },
      error: err => {
        this.error = this.errorMessage(err, 'Could not delete question.');
        this.cdr.markForCheck();
      }
    });
  }

  private emptyForm(topicId: number | null = null): QuestionForm {
    return {
      topic_id: topicId,
      prompt: '',
      explanation: '',
      active: true,
      choices: [
        { text: '', alternatives: '', is_correct: true },
        { text: '', alternatives: '', is_correct: false },
        { text: '', alternatives: '', is_correct: false }
      ]
    };
  }

  private buildPayload(): QuestionPayload | null {
    const prompt = this.form.prompt.trim();
    if (!this.form.topic_id) {
      this.editorError = 'Select a topic.';
      return null;
    }
    if (!prompt) {
      this.editorError = 'Question text is required.';
      return null;
    }
    if (this.form.choices.some(choice => !choice.text.trim())) {
      this.editorError = 'All three answer choices are required.';
      return null;
    }
    if (this.form.choices.filter(choice => choice.is_correct).length !== 1) {
      this.editorError = 'Exactly one answer must be marked correct.';
      return null;
    }

    const choices: QuestionChoiceInput[] = this.form.choices.map(choice => ({
      text: choice.text.trim(),
      alternatives: choice.alternatives
        .split(/\r?\n|\|\|/)
        .map(value => value.trim())
        .filter(Boolean),
      is_correct: choice.is_correct
    }));

    return {
      topic_id: this.form.topic_id,
      prompt,
      explanation: this.form.explanation.trim() || null,
      active: this.form.active,
      choices
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
