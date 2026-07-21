/** Ticket price helpers: UI dollars ↔ stored cents. */

export function dollarsInputToCents(input: string): number | null {
  const trimmed = input.trim();

  if (!trimmed) {
    return null;
  }

  if (!/^\d+(\.\d{0,2})?$/.test(trimmed)) {
    return null;
  }

  const dollars = Number(trimmed);

  if (!Number.isFinite(dollars) || dollars < 0) {
    return null;
  }

  return Math.round(dollars * 100);
}

export function centsToDollarsInput(cents: number): string {
  if (!Number.isFinite(cents) || cents < 0) {
    return '';
  }

  return (cents / 100).toFixed(2);
}

export function formatTicketPriceLabel(cents: number, currency = 'usd'): string {
  if (cents === 0) {
    return 'Free';
  }

  const amount = cents / 100;

  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount);
  } catch {
    return `$${amount.toFixed(2)}`;
  }
}

export type TicketTypeFormValues = {
  name: string;
  priceDollars: string;
  capacity: string;
  isActive: boolean;
};

export type TicketTypeFormErrors = Partial<Record<'name' | 'priceDollars' | 'capacity', string>>;

export function validateTicketTypeForm(values: TicketTypeFormValues): TicketTypeFormErrors {
  const errors: TicketTypeFormErrors = {};

  if (!values.name.trim()) {
    errors.name = 'Ticket name is required.';
  }

  const cents = dollarsInputToCents(values.priceDollars);
  if (cents === null) {
    errors.priceDollars = 'Enter a valid price like 25 or 25.00.';
  }

  const capacityTrimmed = values.capacity.trim();
  if (!capacityTrimmed) {
    errors.capacity = 'Quantity is required.';
  } else if (!/^\d+$/.test(capacityTrimmed) || Number(capacityTrimmed) < 1) {
    errors.capacity = 'Enter a quantity of at least 1.';
  }

  return errors;
}
