import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { AnimationName } from '../../../../core/mascot/pixel-mascot';
import { ToastService } from '../../../../core/ui/toast.service';
import { MascotComponent } from '../mascot/mascot.component';

const BURSTS: readonly AnimationName[] = ['wave', 'dance', 'happy', 'wave'];

/**
 * The companion on screen, always: bottom right, breathing and blinking, with a little show every so often
 * (a wave, a dance, a thumbs up). When the app has something to say (a save, an error, an order filled, an alert)
 * it speaks it in a bubble and acts it out. Tap it to make it dance.
 */
@Component({
  selector: 'app-mascot-dock',
  standalone: true,
  imports: [MascotComponent],
  templateUrl: './mascot-dock.component.html',
  styleUrl: './mascot-dock.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MascotDockComponent {
  protected readonly toasts = inject(ToastService);
  private readonly burst = signal<AnimationName | null>(null);

  /** What the companion is doing: acting out the latest message, else a passing burst, else breathing. */
  protected readonly action = computed<AnimationName>(() => {
    const latest = this.toasts.toasts().at(-1);
    return latest?.action ?? this.burst() ?? 'idle';
  });

  constructor() {
    const destroyRef = inject(DestroyRef);
    const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!reduced) {
      const interval = setInterval(() => {
        this.burst.set(BURSTS[Math.floor(Math.random() * BURSTS.length)]);
        setTimeout(() => this.burst.set(null), 2600);
      }, 14_000);
      destroyRef.onDestroy(() => clearInterval(interval));
    }
  }
}
