const PRODUCT_MESSAGES: Record<string, string> = {
  'vesty.unauthenticated': 'Sign in to continue',
  'vesty.profile_required': 'Unable to record investments right now',
  'vesty.not_club_member': 'Unable to load this Investment Day',
  'vesty.cycle_invalid': 'Unable to confirm investments right now',
  'vesty.cycle_not_open': 'This Investment Day is no longer open',
  'vesty.strategy_missing': 'Unable to confirm investments right now',
  'vesty.amount_invalid': 'Unable to confirm investments right now',
  'vesty.invalid_target': 'Unable to confirm investments right now',
  'vesty.invalid_allocations': 'Unable to confirm investments right now',
  'vesty.quantity_invalid': 'Enter the number of units you purchased for each investment',
  'vesty.execution_price_invalid': 'Enter a positive execution price, or leave it blank',
  'vesty.execution_reports_invalid': 'Enter the number of units you purchased for each investment',
  'vesty.duplicate_execution_report': 'Unable to confirm investments right now',
  'vesty.execution_targets_incomplete': 'Enter the number of units you purchased for each investment',
  'vesty.confirmation_mode_invalid': 'Unable to confirm investments right now',
  'vesty.report_conflict': 'This Investment Day was already reported with different details. A versioned correction is not available yet.',
  'vesty.purchase_lines_invalid': 'Check the amounts you entered and try again',
  'vesty.report_mode_invalid': 'Unable to save this Investment Day report',
  'vesty.outcome_invalid': 'Unable to save this Investment Day report',
  'vesty.client_report_id_invalid': 'Unable to save this Investment Day report',
  'vesty.contribution_commitment_required': 'Set your contribution to continue',
  'vesty.not_in_snapshot': 'You are not part of this Investment Day',
  'vesty.contribution_commitment_invalid': 'Enter how much you want to contribute',
  'vesty.reporting_not_open': 'Reporting has not opened for this Investment Day yet',
  'vesty.reporting_closed': 'The reporting window for this Investment Day has closed',
  'vesty.monthly_saving_setup_required': 'Set your contribution before monthly saving',
  'vesty.monthly_saving_setup_unavailable': 'Monthly saving is not available for this club yet',
  'vesty.monthly_saving_setup_conflict': 'This monthly saving confirmation was already saved with different details',
  'vesty.client_attestation_id_invalid': 'Unable to save this monthly saving confirmation',
};

function logInvestIssue(context: string, error: { code?: string } | unknown): void {
  if (error && typeof error === 'object' && 'code' in error) {
    console.warn(`[invest] ${context}`, (error as { code?: string }).code ?? 'unknown');
    return;
  }

  console.warn(`[invest] ${context}`);
}

export function extractInvestErrorCode(error: { message?: string } | unknown): string | null {
  if (!error || typeof error !== 'object' || !('message' in error)) {
    return null;
  }

  const message = typeof error.message === 'string' ? error.message : '';
  const match = /vesty\.[a-z_]+/.exec(message);
  return match?.[0] ?? null;
}

export function isReportConflictError(error: unknown): boolean {
  if (extractInvestErrorCode(error) === 'vesty.report_conflict') {
    return true;
  }
  return error instanceof Error && error.message.includes('already reported with different details');
}

export function mapInvestError(
  error: { message?: string; code?: string } | unknown,
  fallback: string,
  context: string,
): string {
  logInvestIssue(context, error);
  const code = extractInvestErrorCode(error);
  if (code && PRODUCT_MESSAGES[code]) {
    return PRODUCT_MESSAGES[code];
  }
  return fallback;
}
