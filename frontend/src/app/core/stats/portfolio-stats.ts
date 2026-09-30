import { PositionResponse } from '../models/account.model';
import { OrderHistoryEntry } from '../models/order.model';

// Everything here is derived from what the Trade REST API already returns. There is no price
// feed, so nothing is a market value: allocation is by cost, execution quality compares a
// filled order's executed price with its own limit.

export interface AllocationSlice {
  label: string;
  cost: number;
  share: number;
}

const MAX_SLICES = 5;

/** Holdings by cost, biggest first. Anything beyond the top few is folded into "Other". */
export function allocation(positions: PositionResponse[]): AllocationSlice[] {
  const costed = positions
    .map((position) => ({ label: position.symbol, cost: position.quantity * position.averageCost }))
    .filter((slice) => slice.cost > 0)
    .sort((left, right) => right.cost - left.cost);

  const total = costed.reduce((sum, slice) => sum + slice.cost, 0);
  if (total === 0) {
    return [];
  }

  const head = costed.slice(0, MAX_SLICES);
  const rest = costed.slice(MAX_SLICES);
  if (rest.length > 0) {
    head.push({ label: 'Other', cost: rest.reduce((sum, slice) => sum + slice.cost, 0) });
  }

  return head.map((slice) => ({ ...slice, share: (slice.cost / total) * 100 }));
}

export interface DayActivity {
  key: string;
  date: Date;
  filled: number;
  working: number;
  rejected: number;
  cancelled: number;
  total: number;
}

function dayKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Orders per local day for the last `days` days ending today, split by status. Empty days are kept so the axis is honest. */
export function activityByDay(
  orders: OrderHistoryEntry[],
  days = 14,
  now: Date = new Date()
): DayActivity[] {
  const buckets: DayActivity[] = [];
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset);
    buckets.push({ key: dayKey(date), date, filled: 0, working: 0, rejected: 0, cancelled: 0, total: 0 });
  }

  const byKey = new Map(buckets.map((bucket) => [bucket.key, bucket]));
  for (const order of orders) {
    const bucket = byKey.get(dayKey(new Date(order.createdOn)));
    if (!bucket) {
      continue;
    }
    bucket.total += 1;
    switch (order.status) {
      case 'FILLED':
        bucket.filled += 1;
        break;
      case 'NEW':
        bucket.working += 1;
        break;
      case 'REJECTED':
        bucket.rejected += 1;
        break;
      case 'CANCELLED':
        bucket.cancelled += 1;
        break;
    }
  }

  return buckets;
}

export interface ExecutionRow {
  symbol: string;
  orders: number;
  /** Positive is better for the trader: a buy filled under its limit, a sell filled over it. */
  improvementPct: number;
}

/** Average price improvement per symbol over filled orders that carried a limit price. */
export function executionQuality(orders: OrderHistoryEntry[]): ExecutionRow[] {
  const bySymbol = new Map<string, { total: number; count: number }>();

  for (const order of orders) {
    if (
      order.status !== 'FILLED' ||
      order.price === null ||
      order.price <= 0 ||
      order.executedPrice === null
    ) {
      continue;
    }

    const improvement =
      order.side === 'BUY'
        ? ((order.price - order.executedPrice) / order.price) * 100
        : ((order.executedPrice - order.price) / order.price) * 100;

    const entry = bySymbol.get(order.symbol) ?? { total: 0, count: 0 };
    entry.total += improvement;
    entry.count += 1;
    bySymbol.set(order.symbol, entry);
  }

  return [...bySymbol.entries()]
    .map(([symbol, { total, count }]) => ({ symbol, orders: count, improvementPct: total / count }))
    .sort((left, right) => Math.abs(right.improvementPct) - Math.abs(left.improvementPct));
}
