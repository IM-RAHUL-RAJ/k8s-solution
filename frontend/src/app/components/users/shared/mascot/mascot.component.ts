import { ChangeDetectionStrategy, Component, ViewEncapsulation, computed, inject, input, signal } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { MASCOT_LABEL, MascotPose, MascotType, mascotSvg } from '../../../../core/mascot/mascot-svg';
import { MascotService } from '../../../../core/mascot/mascot.service';

export type MascotState = 'idle' | 'loading' | 'happy' | 'empty';

const THOUGHTS: Record<MascotType, readonly string[]> = {
  owl: ['Hoo knows? Check the news first.', 'Patience is a position too.', 'Wise owls diversify.'],
  rabbit: ['Hop in slowly. Small steps compound.', 'Carrots grow; so can a plan.', 'No rush. Markets reopen tomorrow.'],
  cat: ['Purr-fect time to review your alerts.', 'Nap first, trade later.', 'Curiosity is fine. Impulse is not.']
};

/**
 * The customer's companion. States: idle breathes, loading thinks inside a turning ring, happy jumps,
 * empty looks thoughtful and slides in. Tapping it shows a thought. Motion stops under reduced-motion.
 * The artwork is generated from our own constants, so it is the one place innerHTML is trusted.
 */
@Component({
  selector: 'app-mascot',
  standalone: true,
  templateUrl: './mascot.component.html',
  styleUrl: './mascot.component.css',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MascotComponent {
  private readonly sanitizer = inject(DomSanitizer);
  private readonly preferred = inject(MascotService);

  /** Leave out to use the companion the customer picked. */
  readonly type = input<MascotType | null>(null);
  readonly state = input<MascotState>('idle');
  readonly size = input(120);
  readonly interactive = input(true);

  protected readonly thought = signal<string | null>(null);
  private thoughtTimer: ReturnType<typeof setTimeout> | null = null;

  protected readonly resolvedType = computed(() => this.type() ?? this.preferred.type());
  protected readonly label = computed(() => MASCOT_LABEL[this.resolvedType()]);

  protected readonly pose = computed<MascotPose>(() => {
    switch (this.state()) {
      case 'happy':
        return 'happy';
      case 'empty':
      case 'loading':
        return 'thinking';
      default:
        return 'idle';
    }
  });

  protected readonly svg = computed<SafeHtml>(() =>
    this.sanitizer.bypassSecurityTrustHtml(mascotSvg(this.resolvedType(), this.pose(), this.label()))
  );

  protected poke(): void {
    if (!this.interactive()) {
      return;
    }
    const lines = THOUGHTS[this.resolvedType()];
    this.thought.set(lines[Math.floor(Math.random() * lines.length)]);
    if (this.thoughtTimer !== null) {
      clearTimeout(this.thoughtTimer);
    }
    this.thoughtTimer = setTimeout(() => this.thought.set(null), 3200);
  }
}
