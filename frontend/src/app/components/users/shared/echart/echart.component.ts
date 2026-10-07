import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, effect, inject, input, signal, viewChild } from '@angular/core';

/** What a chart needs to be drawn: an ECharts option, built by the page. */
export type ChartOption = Record<string, unknown>;

/**
 * A thin, lazy wrapper over Apache ECharts. The library is a separate download that arrives the first time a
 * chart is on screen, and only the parts used here (line, pie, tooltip, canvas) are bundled. It resizes with its
 * box, redraws whenever its option changes (the page rebuilds it when the theme does), and gives screen readers the summary in [label].
 */
@Component({
  selector: 'app-echart',
  standalone: true,
  template: `<div #host class="echart" role="img" [attr.aria-label]="label()" [style.height.px]="height()"></div>`,
  styles: [':host{display:block}.echart{width:100%}'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EchartComponent {
  readonly option = input.required<ChartOption>();
  readonly label = input('Chart');
  readonly height = input(260);

  private readonly host = viewChild.required<ElementRef<HTMLElement>>('host');
  private readonly destroyRef = inject(DestroyRef);
  private readonly ready = signal(false);
  private instance: import('echarts/core').ECharts | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private destroyed = false;
  private starting = false;

  constructor() {
    effect(() => {
      const option = this.option();
      if (this.ready()) {
        this.instance?.setOption(option, true);
      } else if (!this.starting) {
        this.starting = true;
        void this.init();
      }
    });

    this.destroyRef.onDestroy(() => {
      this.destroyed = true;
      this.resizeObserver?.disconnect();
      this.instance?.dispose();
      this.instance = null;
    });
  }

  private async init(): Promise<void> {
    const [core, charts, components, renderers] = await Promise.all([
      import('echarts/core'),
      import('echarts/charts'),
      import('echarts/components'),
      import('echarts/renderers')
    ]);
    if (this.destroyed) {
      return;
    }
    core.use([charts.LineChart, charts.PieChart, components.GridComponent, components.TooltipComponent, components.LegendComponent, renderers.CanvasRenderer]);

    const element = this.host().nativeElement;
    // Half the pixels, shown at full size and never smoothed (canvas { image-rendering: pixelated }): pixel art.
    this.instance = core.init(element, undefined, { devicePixelRatio: 0.5 });
    // The option may have changed while the library was loading: draw the latest one.
    this.instance.setOption(this.option(), true);
    this.ready.set(true);

    if (typeof ResizeObserver !== "undefined") {
      this.resizeObserver = new ResizeObserver(() => this.instance?.resize());
      this.resizeObserver.observe(element);
    }
  }
}

/** Reads a design token from the page, so charts follow the theme. */
/** The one text style for every chart: the pixel face, large enough to survive the pixelation. */
export function pixelText(color: string, size = 18): Record<string, unknown> {
  return { color, fontFamily: 'Doto, monospace', fontWeight: 700, fontSize: size };
}

/** A tooltip that opens on a click and stays, with a hard pixel border. */
export function pixelTooltip(base: Record<string, unknown>): Record<string, unknown> {
  return {
    triggerOn: 'click',
    confine: true,
    borderWidth: 4,
    borderColor: token('--text', '#0a0a0a'),
    backgroundColor: token('--bg', '#ffffff'),
    padding: [8, 12],
    textStyle: pixelText(token('--text', '#0a0a0a'), 18),
    extraCssText: 'border-radius:0;box-shadow:none;',
    ...base
  };
}

export function token(name: string, fallback: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}
