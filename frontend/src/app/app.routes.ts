import { Routes } from '@angular/router';
import { HomeComponent } from './pages/home/home.component';
import { ImportComponent } from './pages/import/import.component';
import { QuizComponent } from './pages/quiz/quiz.component';
import { ResultsComponent } from './pages/results/results.component';

export const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'quiz/:sessionId', component: QuizComponent },
  { path: 'results/:sessionId', component: ResultsComponent },
  { path: 'import', component: ImportComponent },
  { path: '**', redirectTo: '' }
];
