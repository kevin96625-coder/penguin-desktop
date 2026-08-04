/**
 * Formatting rules for the usage page.
 *
 * The one that matters: `cost` is `number | null` and each row carries `hasUncosted`.
 * `null` means "no model in this row has a pricing table", which is NOT zero — rendering
 * it as `$0.00` would claim the run was free. It renders as an em dash, and a partial sum
 * (cost present *and* hasUncosted) is marked as partial rather than presented as the truth.
 */

/** Em dash placeholder for "not measurable", never for zero. */
export const NO_VALUE = "—";

export function formatTokens(value: number): string {
  return value.toLocaleString("en-US");
}

/** Cost cell text. Returns the dash whenever the server could not price the row. */
export function formatCost(cost: number | null): string {
  if (cost === null) return NO_VALUE;
  return `$${cost.toFixed(cost >= 1 ? 2 : 4)}`;
}

/** Human explanation for a cost cell, used as the cell's `title` / a footnote. */
export function costHint(cost: number | null, hasUncosted: boolean): string | undefined {
  if (cost === null && hasUncosted) return "所用模型未配置定价表，成本无法计算";
  if (cost === null) return "暂无用量，成本无法计算";
  if (hasUncosted) return "部分模型未配置定价表，此金额为不完整的部分合计";
  return undefined;
}

/** True when the row's cost figure must not be read as a complete number. */
export function isCostIncomplete(cost: number | null, hasUncosted: boolean): boolean {
  return cost === null || hasUncosted;
}

export function formatTime(ts: string): string {
  const date = new Date(ts);
  if (Number.isNaN(date.getTime())) return ts;
  return date.toLocaleString();
}
