import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { ExecutionRow } from '../../../../core/stats/portfolio-stats';

/** How filled orders compared with their own limit, per symbol. Right of centre is better for the trader. */
@Component({
  selector: 'app-execution-quality',
  standalone: true,
  imports: [DecimalPipe],
  templateUrl: './execution-quality.component.html',
  styleUrl: './execution-quality.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ExecutionQualityComponent {
  readonly rows = input.required<ExecutionRow[]>();

  protected readonly scale = computed(() =>
    Math.max(1, ...this.rows().map((row) => Math.abs(row.improvementPct)))
  );

  protected readonly view = computed(() =>
    this.rows().map((row) => ({
      ...row,
      good: row.improvementPct >= 0,
      // Half the track is each direction; the longest bar fills its half.
      width: Math.min(Math.abs(row.improvementPct) / this.scale(), 1) * 50
    }))
  );
}
