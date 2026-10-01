import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component } from '@angular/core';
import { ApiService } from '../../core/api.service';

@Component({
  selector: 'app-import',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="card import-card">
      <h1>Bulk provision questions</h1>
      <p class="muted">Upload a QuizStake JSON or CSV file. Each question must contain exactly three answers and exactly one correct answer.</p>
      <input type="file" accept=".json,.csv" (change)="choose($event)">
      <button class="btn" [disabled]="!file || uploading" (click)="upload()">
        {{ uploading ? 'Uploading…' : 'Import Questions' }}
      </button>

      <div *ngIf="result" class="result">
        <strong>{{ result.imported }} imported</strong> · {{ result.skipped }} skipped
        <ul *ngIf="result.errors.length">
          <li *ngFor="let error of result.errors" class="error">{{ error }}</li>
        </ul>
      </div>
      <p *ngIf="error" class="error">{{ error }}</p>
    </section>
  `,
  styles: [`
    .import-card { max-width:720px; display:grid; gap:18px; }
    h1 { margin:0; }
    .result { padding:14px; border-radius:10px; background:#f2f4f7; }
  `]
})
export class ImportComponent {
  file: File | null = null;
  uploading = false;
  result: { imported: number; skipped: number; errors: string[] } | null = null;
  error = '';

  constructor(
    private readonly api: ApiService,
    private readonly cdr: ChangeDetectorRef
  ) {}

  choose(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.file = input.files?.[0] ?? null;
    this.result = null;
    this.error = '';
  }

  upload(): void {
    if (!this.file) return;
    this.uploading = true;
    this.error = '';
    this.api.importQuestions(this.file).subscribe({
      next: result => {
        this.result = result;
        this.uploading = false;
        this.cdr.markForCheck();
      },
      error: err => {
        this.error = err?.error?.detail || 'Import failed.';
        this.uploading = false;
        this.cdr.markForCheck();
      }
    });
  }
}
