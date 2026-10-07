import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, effect, inject, input, signal, untracked, viewChild } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { ApiErrorMessageService } from '../../../core/services/api-error-message.service';
import { CANDLE_PERIODS, Candle, CandlePeriod, CandlesService } from '../../../core/services/candles.service';

const STORAGE_KEY = 'quorum-candle-period';

/** How many bars each period asks for: enough to read a trend, few enough to stay fast. */
export const BARS_FOR: Record<CandlePeriod, number> = { '1d': 60, '4h': 90, '1h': 120, '15m': 120 };

function storedPeriod(): CandlePeriod {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return CANDLE_PERIODS.find((period) => period.value === saved)?.value ?? '1d';
  } catch {
    return '1d';
  }
}

interface Legend {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number | null;
}

/**
 * A candlestick chart with volume for one instrument and a choice of bar size. Green candles closed up, red
 * closed down. The chart library is loaded the first time a chart is shown, so it stays out of the main bundle.
 * Hover (or touch) a candle to read its open, high, low, close and volume.
 */
@Component({
  selector: 'app-candle-chart',
  standalone: true,
  imports: [DecimalPipe],
  templateUrl: './candle-chart.component.html',
  styleUrl: './candle-chart.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CandleChartComponent {
  private readonly candlesService = inject(CandlesService);
  private readonly errorMessages = inject(ApiErrorMessageService);
  private readonly destroyRef = inject(DestroyRef);

  readonly symbol = input.required<string>();
  readonly currency = input<string | null>(null);

  protected readonly periods = CANDLE_PERIODS;
  protected readonly period = signal<CandlePeriod>(storedPeriod());
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly candles = signal<Candle[]>([]);
  protected readonly legend = signal<Legend | null>(null);

  private readonly host = viewChild.required<ElementRef<HTMLElement>>('host');
  private chart: import('lightweight-charts').IChartApi | null = null;
  private candleSeries: import('lightweight-charts').ISeriesApi<'Candlestick'> | null = null;
  private volumeSeries: import('lightweight-charts').ISeriesApi<'Histogram'> | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private themeObserver: MutationObserver | null = null;
  private requestId = 0;

  constructor() {
    // A new symbol or period asks for new candles; an old answer arriving late is ignored.
    effect(() => {
      const symbol = this.symbol();
      const period = this.period();
      untracked(() => this.fetch(symbol, period));
    });

    this.destroyRef.onDestroy(() => {
      this.resizeObserver?.disconnect();
      this.themeObserver?.disconnect();
      this.chart?.remove();
      this.chart = null;
    });
  }

  protected choose(period: CandlePeriod): void {
    if (period === this.period()) {
      return;
    }
    this.period.set(period);
    try {
      localStorage.setItem(STORAGE_KEY, period);
    } catch {
      // Storage blocked: the choice holds for this visit.
    }
  }

  protected retry(): void {
    this.fetch(this.symbol(), this.period());
  }

  private fetch(symbol: string, period: CandlePeriod): void {
    const id = ++this.requestId;
    this.loading.set(true);
    this.error.set(null);
    this.legend.set(null);

    this.candlesService.getCandles(symbol, period, BARS_FOR[period]).subscribe({
      next: (response) => {
        if (id !== this.requestId) {
          return;
        }
        this.candles.set(response.candles);
        this.loading.set(false);
        void this.draw(period);
      },
      error: (error: unknown) => {
        if (id !== this.requestId) {
          return;
        }
        this.candles.set([]);
        this.error.set(this.errorMessages.getMessage(error));
        this.loading.set(false);
      }
    });
  }

  private async draw(period: CandlePeriod): Promise<void> {
    const candles = this.candles();
    if (candles.length === 0) {
      return;
    }
    const lib = await import('lightweight-charts');
    // The element exists once loading is false and the view has updated.
    await Promise.resolve();
    const element = this.host().nativeElement;

    if (!this.chart) {
      this.chart = lib.createChart(element, {
        autoSize: false,
        width: element.clientWidth || 600,
        height: 320,
        ...this.themeOptions(),
        crosshair: { mode: lib.CrosshairMode.Magnet },
        timeScale: { borderVisible: false, secondsVisible: false },
        rightPriceScale: { borderVisible: false }
      });
      this.candleSeries = this.chart.addSeries(lib.CandlestickSeries, this.candleColors());
      this.volumeSeries = this.chart.addSeries(lib.HistogramSeries, { priceFormat: { type: 'volume' }, priceScaleId: '' });
      this.volumeSeries.priceScale().applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });

      this.chart.subscribeCrosshairMove((param) => this.onCrosshair(param));
      // Older browsers and test environments have no ResizeObserver: the chart then keeps its first width.
      if (typeof ResizeObserver !== "undefined") {
        this.resizeObserver = new ResizeObserver(() => this.chart?.applyOptions({ width: element.clientWidth }));
        this.resizeObserver.observe(element);
      }
      // Light and dark switch while the page is open.
      this.themeObserver = new MutationObserver(() => this.applyTheme());
      this.themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    }

    this.chart.applyOptions({ timeScale: { timeVisible: period !== '1d' } });
    this.candleSeries?.setData(
      candles.map((candle) => ({
        time: this.toTime(candle.timestamp),
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close
      }))
    );
    this.volumeSeries?.setData(
      candles.map((candle) => ({
        time: this.toTime(candle.timestamp),
        value: candle.volume ?? 0,
        color: candle.close >= candle.open ? this.cssColor('--ok', '#1b7a52') + '66' : this.cssColor('--reject', '#c0392b') + '66'
      }))
    );
    this.chart.timeScale().fitContent();
  }

  private toTime(timestamp: string): import('lightweight-charts').UTCTimestamp {
    return Math.floor(Date.parse(timestamp) / 1000) as import('lightweight-charts').UTCTimestamp;
  }

  private onCrosshair(param: import('lightweight-charts').MouseEventParams): void {
    if (!param.time || !this.candleSeries) {
      this.legend.set(null);
      return;
    }
    const bar = param.seriesData.get(this.candleSeries) as { open: number; high: number; low: number; close: number } | undefined;
    if (!bar) {
      this.legend.set(null);
      return;
    }
    const seconds = Number(param.time);
    const match = this.candles().find((candle) => this.toTime(candle.timestamp) === seconds);
    this.legend.set({
      time: new Date(seconds * 1000).toLocaleString(undefined, this.period() === '1d' ? { dateStyle: 'medium' } : { dateStyle: 'medium', timeStyle: 'short' }),
      open: bar.open,
      high: bar.high,
      low: bar.low,
      close: bar.close,
      volume: match?.volume ?? null
    });
  }

  private applyTheme(): void {
    this.chart?.applyOptions(this.themeOptions());
    this.candleSeries?.applyOptions(this.candleColors());
  }

  private themeOptions() {
    const text = this.cssColor('--muted', '#6b7078');
    const line = this.cssColor('--line', '#e5e5ea');
    return {
      layout: { background: { color: 'transparent' }, textColor: text, fontFamily: 'inherit' },
      grid: { vertLines: { color: line }, horzLines: { color: line } }
    } as const;
  }

  private candleColors() {
    const up = this.cssColor('--ok', '#1b7a52');
    const down = this.cssColor('--reject', '#c0392b');
    return { upColor: up, downColor: down, borderUpColor: up, borderDownColor: down, wickUpColor: up, wickDownColor: down };
  }

  /** Reads a design token, so the chart follows the theme; falls back to a fixed colour where there is no document. */
  private cssColor(token: string, fallback: string): string {
    const value = getComputedStyle(document.documentElement).getPropertyValue(token).trim();
    // The volume bars append an alpha byte, which only works on a six-digit hex.
    return /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
  }
}
