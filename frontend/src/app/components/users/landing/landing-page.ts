import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { BrandLogoComponent } from '../shared/brand-logo/brand-logo.component';
import { ThemeService } from '../../../core/theme/theme.service';

type FeatureCard = {
  title: string;
  description: string;
};

@Component({
  selector: 'app-landing-page',
  standalone: true,
  imports: [RouterLink, CommonModule, BrandLogoComponent],
  templateUrl: './landing-page.html',
  styleUrl: './landing-page.css',
  host: { 'data-theme': 'auto' }
})
export class LandingPage {
  private readonly themeService = inject(ThemeService);
  protected readonly currentTheme = signal<'light' | 'dark'>('light');
  protected readonly cards = signal<FeatureCard[]>([
    {
      title: 'Standalone components',
      description: 'The workspace starts with standalone Angular components instead of NgModules.'
    },
    {
      title: 'Signals-first state',
      description: 'Signals drive the shell and the landing page so the initial scaffold matches the ticket.'
    },
    {
      title: 'Colocated tests',
      description: 'Specs sit next to the components they cover for easier review and maintenance.'
    }
  ]);

  protected readonly cardCount = computed(() => this.cards().length);

  constructor() {
    this.currentTheme.set(this.themeService.isDarkMode() ? 'dark' : 'light');
  }

  protected toggleTheme(): void {
    this.themeService.toggleTheme();
    this.currentTheme.set(this.themeService.isDarkMode() ? 'dark' : 'light');
  }
}