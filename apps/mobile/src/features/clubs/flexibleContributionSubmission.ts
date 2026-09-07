export interface FlexibleContributionSubmissionCallbacks {
  onSubmittingChange: (isSubmitting: boolean) => void;
  onErrorChange: (error: string | null) => void;
}

export function presentFlexibleContributionSubmitLabel(
  isSubmitting: boolean,
  busy: boolean,
  submitLabel: string,
): string {
  return isSubmitting || busy ? 'Saving…' : submitLabel;
}

export async function runFlexibleContributionSubmission(
  amountMinor: number,
  onSubmit: (amountMinor: number) => Promise<void>,
  callbacks: FlexibleContributionSubmissionCallbacks,
): Promise<void> {
  callbacks.onSubmittingChange(true);
  callbacks.onErrorChange(null);

  try {
    await onSubmit(amountMinor);
  } catch (caught) {
    callbacks.onErrorChange(
      caught instanceof Error ? caught.message : 'Unable to save your contribution',
    );
  } finally {
    callbacks.onSubmittingChange(false);
  }
}
