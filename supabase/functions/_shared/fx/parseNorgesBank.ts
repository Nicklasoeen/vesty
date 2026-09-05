import { assertIsoDate, decimalStringFromUnknown } from '../market-data/validate.ts';

import { FxSyncError, type FxObservation } from './types.ts';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function seriesDimensionId(structure: Record<string, unknown>, index: number): string | null {
  const dimensions = isRecord(structure.dimensions) ? structure.dimensions : null;
  const series = dimensions && Array.isArray(dimensions.series) ? dimensions.series : null;
  const dimension = series && isRecord(series[index]) ? series[index] : null;
  const values = dimension && Array.isArray(dimension.values) ? dimension.values : null;
  const first = values && isRecord(values[0]) ? values[0] : null;
  return first && typeof first.id === 'string' ? first.id : null;
}

function seriesAttributeId(structure: Record<string, unknown>, index: number): string | null {
  const attributes = isRecord(structure.attributes) ? structure.attributes : null;
  const series = attributes && Array.isArray(attributes.series) ? attributes.series : null;
  const attribute = series && isRecord(series[index]) ? series[index] : null;
  const values = attribute && Array.isArray(attribute.values) ? attribute.values : null;
  const first = values && isRecord(values[0]) ? values[0] : null;
  return first && typeof first.id === 'string' ? first.id : null;
}

function observationDates(structure: Record<string, unknown>): string[] {
  const dimensions = isRecord(structure.dimensions) ? structure.dimensions : null;
  const observation = dimensions && Array.isArray(dimensions.observation) ? dimensions.observation : null;
  const time = observation && isRecord(observation[0]) ? observation[0] : null;
  const values = time && Array.isArray(time.values) ? time.values : [];

  return values.flatMap((value) => {
    if (!isRecord(value) || typeof value.id !== 'string') {
      return [];
    }

    try {
      return [assertIsoDate(value.id)];
    } catch {
      return [];
    }
  });
}

function unitMultiplier(structure: Record<string, unknown>): number {
  const raw = seriesAttributeId(structure, 2);
  if (raw == null || raw === '') {
    return 0;
  }

  if (!/^-?\d+$/.test(raw)) {
    throw new FxSyncError('malformed', 'Norges Bank UNIT_MULT is not an integer');
  }

  return Number.parseInt(raw, 10);
}

function todayUtcDate(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function parseNorgesBankEurNok(payload: unknown, now = new Date()): FxObservation[] {
  if (!isRecord(payload) || !isRecord(payload.data)) {
    throw new FxSyncError('malformed', 'Norges Bank response is not an SDMX-JSON object');
  }

  const dataSets = Array.isArray(payload.data.dataSets) ? payload.data.dataSets : [];
  const dataSet = isRecord(dataSets[0]) ? dataSets[0] : null;
  const structure = isRecord(payload.data.structure) ? payload.data.structure : null;
  if (!dataSet || !structure) {
    throw new FxSyncError('malformed', 'Norges Bank response is missing the data set');
  }

  const baseCurrency = seriesDimensionId(structure, 1);
  const quoteCurrency = seriesDimensionId(structure, 2);
  if (baseCurrency !== 'EUR' || quoteCurrency !== 'NOK') {
    throw new FxSyncError(
      'currency_mismatch',
      `Expected EUR/NOK, received ${baseCurrency ?? 'unknown'}/${quoteCurrency ?? 'unknown'}`,
    );
  }

  const series = isRecord(dataSet.series) ? dataSet.series : null;
  const firstSeries = series ? Object.values(series)[0] : null;
  const seriesRecord = isRecord(firstSeries) ? firstSeries : null;
  const observations = seriesRecord && isRecord(seriesRecord.observations) ? seriesRecord.observations : null;
  if (!observations) {
    throw new FxSyncError('missing_rate', 'Norges Bank response has no EUR/NOK observations');
  }

  const dates = observationDates(structure);
  const unitMult = unitMultiplier(structure);
  if (unitMult !== 0) {
    throw new FxSyncError(
      'malformed',
      `Norges Bank UNIT_MULT must be 0 for per-euro EUR/NOK quotes, received ${unitMult}`,
    );
  }
  const today = todayUtcDate(now);
  const parsed: FxObservation[] = [];

  for (const [indexKey, value] of Object.entries(observations)) {
    const index = Number.parseInt(indexKey, 10);
    if (!Number.isInteger(index) || index < 0 || index >= dates.length) {
      continue;
    }

    const rawRate = Array.isArray(value) ? value[0] : null;
    if (rawRate == null || rawRate === '') {
      continue;
    }

    let rate: string;
    try {
      rate = decimalStringFromUnknown(rawRate);
    } catch {
      continue;
    }

    if (!/^(0|[1-9]\d*)(\.\d+)?$/.test(rate) || rate === '0') {
      continue;
    }

    const rateDate = dates[index];
    if (!rateDate || rateDate > today) {
      continue;
    }

    parsed.push({
      rateDate,
      rate,
      baseCurrency: 'EUR',
      quoteCurrency: 'NOK',
    });
  }

  if (parsed.length === 0) {
    throw new FxSyncError('missing_rate', 'Norges Bank returned no persistable EUR/NOK rates');
  }

  parsed.sort((left, right) => left.rateDate.localeCompare(right.rateDate));
  return parsed;
}
