const EMAIL_FORMAT = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const MIN_PASSWORD_LENGTH = 8;

export type SignInFormValues = {
  email: string;
  password: string;
};

export type SignUpFormValues = {
  email: string;
  password: string;
  confirmPassword: string;
};

export type OrganizerAuthFieldErrors = Partial<
  Record<keyof SignUpFormValues | keyof SignInFormValues, string>
>;

export function validateSignInForm(values: SignInFormValues): OrganizerAuthFieldErrors {
  const errors: OrganizerAuthFieldErrors = {};

  if (!values.email.trim()) {
    errors.email = 'Email is required.';
  } else if (!EMAIL_FORMAT.test(values.email.trim())) {
    errors.email = 'Enter a valid email address.';
  }

  if (!values.password) {
    errors.password = 'Password is required.';
  }

  return errors;
}

export function validateResendConfirmationEmail(email: string): string | null {
  if (!email.trim()) {
    return 'Email is required.';
  }

  if (!EMAIL_FORMAT.test(email.trim())) {
    return 'Enter a valid email address.';
  }

  return null;
}

export function validateSignUpForm(values: SignUpFormValues): OrganizerAuthFieldErrors {
  const errors: OrganizerAuthFieldErrors = {};

  if (!values.email.trim()) {
    errors.email = 'Email is required.';
  } else if (!EMAIL_FORMAT.test(values.email.trim())) {
    errors.email = 'Enter a valid email address.';
  }

  if (!values.password) {
    errors.password = 'Password is required.';
  } else if (values.password.length < MIN_PASSWORD_LENGTH) {
    errors.password = `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }

  if (!values.confirmPassword) {
    errors.confirmPassword = 'Confirm your password.';
  } else if (values.password !== values.confirmPassword) {
    errors.confirmPassword = 'Passwords do not match.';
  }

  return errors;
}
