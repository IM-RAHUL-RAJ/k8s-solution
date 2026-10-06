import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** The Quorum mark: a ring of voices around one decision, in the brand gradient. */
@Component({
  selector: 'app-brand-logo',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg [attr.width]="size()" [attr.height]="size()" viewBox="0 0 64 64" aria-hidden="true" class="mark">
      <defs>
        <linearGradient id="quorum-grad" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
          <stop offset="0" stop-color="#0d8a66" />
          <stop offset="0.55" stop-color="#0f8f94" />
          <stop offset="1" stop-color="#2f62d6" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="18" fill="url(#quorum-grad)" />
      <circle cx="31" cy="30" r="14" fill="none" stroke="#fff" stroke-width="5.5" />
      <path d="M38 38l10 10" stroke="#fff" stroke-width="5.5" stroke-linecap="round" />
      <circle cx="31" cy="30" r="4.2" fill="#fff" />
    </svg>
    @if (withName()) {
      <span class="name">Quorum</span>
    }
  `,
  styles: [
    `
      :host {
        display: inline-flex;
        align-items: center;
        gap: 10px;
      }

      .mark {
        flex: none;
        filter: drop-shadow(0 6px 10px color-mix(in srgb, var(--accent) 35%, transparent));
        transition: transform 500ms var(--ease);
      }

      :host(:hover) .mark {
        transform: rotate(-12deg) scale(1.06);
      }

      .name {
        font-weight: 800;
        font-size: 1.1em;
        letter-spacing: -0.02em;
        color: var(--logo-name-color, var(--text));
      }
    `
  ]
})
export class BrandLogoComponent {
  readonly size = input(28);
  readonly withName = input(true);
}
