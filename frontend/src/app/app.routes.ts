import { Routes } from '@angular/router';
import { HomeComponent } from './pages/home/home.component';
import { HistoryComponent } from './pages/history/history.component';
import { ImportComponent } from './pages/import/import.component';
import { PerformanceComponent } from './pages/performance/performance.component';
import { QuestionManagementComponent } from './pages/questions/question-management.component';
import { QuizComponent } from './pages/quiz/quiz.component';
import { ResultsComponent } from './pages/results/results.component';
import { TopicManagementComponent } from './pages/topics/topic-management.component';

export const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'quiz/:sessionId', component: QuizComponent },
  { path: 'results/:sessionId', component: ResultsComponent },
  { path: 'history', component: HistoryComponent },
  { path: 'performance', component: PerformanceComponent },
  { path: 'questions', component: QuestionManagementComponent },
  { path: 'topics', component: TopicManagementComponent },
  { path: 'import', component: ImportComponent },
  { path: '**', redirectTo: '' }
];
