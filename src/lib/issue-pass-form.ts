import { validateGuestPhone } from '@/lib/phone-validation';

export const DEFAULT_PASS_TYPE = 'General Admission';

export const CONTACT_REQUIRED_MESSAGE =
  'Add a phone number or email before issuing this pass.';

export type IssuePassFormValues = {
  guestFirstName: string;
  guestLastName: string;
  passType: string;
  guestEmail: string;
  guestPhone: string;
};

export type IssuePassFieldErrors = Partial<Record<keyof IssuePassFormValues, string>>;

const EMAIL_FORMAT = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Stored in passes.guest_name until first_name / last_name columns exist. */
export function combineGuestName(firstName: string, lastName: string): string {
  return `${firstName.trim()} ${lastName.trim()}`.trim();
}

export function validateIssuePassForm(values: IssuePassFormValues): IssuePassFieldErrors {
  const errors: IssuePassFieldErrors = {};

  if (!values.guestFirstName.trim()) {
    errors.guestFirstName = 'First name is required.';
  }

  if (!values.guestLastName.trim()) {
    errors.guestLastName = 'Last name is required.';
  }

  if (!values.passType.trim()) {
    errors.passType = 'Pass type is required.';
  }

  const email = values.guestEmail.trim();
  const phone = values.guestPhone.trim();
  const hasEmail = Boolean(email);
  const hasPhone = Boolean(phone);

  if (!hasEmail && !hasPhone) {
    errors.guestPhone = CONTACT_REQUIRED_MESSAGE;
    return errors;
  }

  if (hasEmail && !EMAIL_FORMAT.test(email)) {
    errors.guestEmail = 'Enter a valid email address.';
  }

  if (hasPhone) {
    const phoneError = validateGuestPhone(values.guestPhone);

    if (phoneError) {
      errors.guestPhone = phoneError;
    }
  }

  return errors;
}
