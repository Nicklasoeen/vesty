/** Visual scale helpers. Do not invent or interpolate financial points. */

export const CHART_VERTICAL_PADDING = 14;
export const CHART_HORIZONTAL_INSET = 8;
export const CHART_DOMAIN_PADDING_RATIO = 0.08;

export function chartDomain(min: number, max: number): { domainMin: number; domainMax: number } {
  const span = Math.max(max - min, 1);
  const pad = span * CHART_DOMAIN_PADDING_RATIO;
  return { domainMin: min - pad, domainMax: max + pad };
}

export function mapChartY(
  amount: number,
  domainMin: number,
  domainMax: number,
  height: number,
  padding: number = CHART_VERTICAL_PADDING,
): number {
  const range = Math.max(domainMax - domainMin, 1);
  const plotHeight = Math.max(height - padding * 2, 1);
  return padding + plotHeight * (1 - (amount - domainMin) / range);
}

export function mapChartX(
  index: number,
  count: number,
  width: number,
  inset: number = CHART_HORIZONTAL_INSET,
): number {
  if (count <= 1) {
    return inset;
  }
  return inset + (index * (width - inset * 2)) / (count - 1);
}

export function isChartYInsidePlot(
  y: number,
  height: number,
  padding: number = CHART_VERTICAL_PADDING,
): boolean {
  return y >= padding - 0.01 && y <= height - padding + 0.01;
}
