import { Component, computed, signal } from '@angular/core';

type FeatureCard = {
  title: string;
  description: string;
};

@Component({
  selector: 'app-landing-page',
  standalone: true,
  templateUrl: './landing-page.html',
  styleUrl: './landing-page.css'
})
export class LandingPage {
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
}