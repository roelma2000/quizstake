import { Component } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink],
  template: `
    <header class="topbar">
      <div class="container bar-inner">
        <a routerLink="/" class="brand">QuizStake</a>
        <nav>
          <a routerLink="/">Dashboard</a>
          <a routerLink="/history">History</a>
          <a routerLink="/performance">Performance</a>
          <a routerLink="/topics">Topics</a>
          <a routerLink="/questions">Questions</a>
          <a routerLink="/import">Bulk Import</a>
        </nav>
      </div>
    </header>
    <main class="container page"><router-outlet /></main>
  `,
  styles: [`
    .topbar { background:#101828; color:#fff; }
    .bar-inner { min-height:64px; display:flex; align-items:center; justify-content:space-between; gap:20px; }
    .brand { color:#fff; text-decoration:none; font-size:20px; font-weight:800; }
    nav { display:flex; gap:18px; flex-wrap:wrap; }
    nav a { color:#d0d5dd; text-decoration:none; font-weight:650; }
    .page { padding:32px 0 56px; }
  `]
})
export class AppComponent {}
