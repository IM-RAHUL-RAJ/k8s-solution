import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="dashboard">
      <div class="dashboard__header">
        <h1>Dashboard</h1>
        <button (click)="logout()" class="primary">Sign Out</button>
      </div>
      <div class="dashboard__content">
        <p>Welcome to the trading dashboard. This is a placeholder for your trading interface.</p>
      </div>
    </div>
  `,
  styles: [`
    .dashboard {
      max-width: 1200px;
      margin: 0 auto;
    }

    .dashboard__header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 2rem 0;
      border-bottom: 1px solid var(--line);
      margin-bottom: 2rem;
    }

    .dashboard__header h1 {
      margin: 0;
      color: var(--text);
    }

    .dashboard__header button {
      background-color: var(--accent);
      color: var(--on-accent);
      padding: 10px 16px;
      border: none;
      border-radius: 8px;
      font-weight: 600;
      cursor: pointer;
    }

    .dashboard__header button:hover {
      opacity: 0.9;
    }

    .dashboard__content {
      padding: 2rem;
      background-color: var(--surface);
      border: 1px solid var(--line);
      border-radius: 10px;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DashboardComponent {
  private authService = inject(AuthService);
  private router = inject(Router);

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/'], { replaceUrl: true });
  }
}
