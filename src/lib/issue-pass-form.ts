import { validateGuestPhone } from '@/lib/phone-validation';

export const DEFAULT_PASS_TYPE = 'General Admission';

export type IssuePassFormValues = {
  guestName: string;
  passType: string;
  guestEmail: string;
  guestPhone: string;
};

export type IssuePassFieldErrors = Partial<Record<keyof IssuePassFormValues, string>>;

export function validateIssuePassForm(values: IssuePassFormValues): IssuePassFieldErrors {
  const errors: IssuePassFieldErrors = {};

  if (!values.guestName.trim()) {
    errors.guestName = 'Guest name is required.';
  }

  if (!values.passType.trim()) {
    errors.passType = 'Pass type is required.';
  }

  const email = values.guestEmail.trim();

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.guestEmail = 'Enter a valid email or leave blank.';
  }

  const phoneError = validateGuestPhone(values.guestPhone);

  if (phoneError) {
    errors.guestPhone = phoneError;
  }

  return errors;
}
