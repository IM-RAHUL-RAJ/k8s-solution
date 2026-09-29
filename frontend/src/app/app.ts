import { Component, signal } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';

type NavigationItem = {
  label: string;
  path: string;
};

@Component({
  selector: 'app-root',
  imports: [RouterLink, RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('Frontend');

  protected readonly navigation = signal<NavigationItem[]>([
    {
      label: 'Landing',
      path: '/'
    }
  ]);
}
