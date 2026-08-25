/**
 * Pure order-confirmation email templates (HTML + plain text).
 * No Deno/Node APIs — safe to import from Edge Functions and local Node preview scripts.
 */

export const SERVICE_FEE_LABEL = '808Tickets service fee';
export const PROCESSING_FEE_LABEL = 'Payment processing fee';
export const OPEN_TICKETS_CTA_LABEL = 'Open Tickets';

export type OrderEmailTicketLine = {
  ticketNumber: number;
  ticketTotal: number;
  passType: string;
  passUrl: string;
};

export type OrderEmailFeeBreakdown = {
  currency: string;
  subtotal_cents: number;
  platform_fee_cents: number;
  processing_fee_cents: number;
  total_cents: number;
};

export type OrderEmailTemplateInput = {
  buyerName: string;
  eventName: string;
  dateLine: string | null;
  venueLine: string | null;
  ticketTotal: number;
  tickets: OrderEmailTicketLine[];
  successUrl: string;
  fees: OrderEmailFeeBreakdown | null;
};

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

export function formatMoneyCents(cents: number, currency: string): string {
  const amount = cents / 100;
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount);
  } catch {
    return `$${(cents / 100).toFixed(2)}`;
  }
}

function moneyRowHtml(label: string, amount: string, emphasize = false): string {
  const labelHtml = emphasize
    ? `<strong style="font-size:16px;color:#111111;">${escapeHtml(label)}</strong>`
    : `<span style="font-size:14px;color:#444444;">${escapeHtml(label)}</span>`;
  const amountHtml = emphasize
    ? `<strong style="font-size:16px;color:#111111;">${escapeHtml(amount)}</strong>`
    : `<span style="font-size:14px;color:#111111;">${escapeHtml(amount)}</span>`;

  return `
<tr>
  <td style="padding:8px 0;border-bottom:1px solid #eeeeee;">${labelHtml}</td>
  <td align="right" style="padding:8px 0;border-bottom:1px solid #eeeeee;white-space:nowrap;">${amountHtml}</td>
</tr>`.trim();
}

/**
 * Branded, mobile-first HTML order confirmation.
 * Single-column tables + inline styles for broad email-client support.
 */
export function renderOrderConfirmationHtml(input: OrderEmailTemplateInput): string {
  const buyer = escapeHtml(input.buyerName);
  const eventName = escapeHtml(input.eventName);
  const successUrl = escapeHtml(input.successUrl);
  const cta = escapeHtml(OPEN_TICKETS_CTA_LABEL);

  const metaLines: string[] = [];
  if (input.dateLine) {
    metaLines.push(
      `<p style="margin:0 0 6px;font-size:14px;line-height:1.5;color:#333333;">${escapeHtml(input.dateLine)}</p>`,
    );
  }
  if (input.venueLine) {
    metaLines.push(
      `<p style="margin:0;font-size:14px;line-height:1.5;color:#333333;">${escapeHtml(input.venueLine)}</p>`,
    );
  }

  const ticketRows = input.tickets
    .map((ticket) => {
      const label = `Ticket ${ticket.ticketNumber} of ${ticket.ticketTotal}`;
      const type = escapeHtml(ticket.passType);
      const url = escapeHtml(ticket.passUrl);
      return `
<tr>
  <td style="padding:12px 0;border-bottom:1px solid #eeeeee;">
    <p style="margin:0 0 4px;font-size:14px;font-weight:700;color:#111111;">${escapeHtml(label)}</p>
    <p style="margin:0 0 8px;font-size:13px;color:#555555;">${type}</p>
    <a href="${url}" style="font-size:14px;font-weight:600;color:#A25BFF;text-decoration:underline;">Open ticket</a>
  </td>
</tr>`.trim();
    })
    .join('\n');

  let feeBlock = '';
  if (input.fees) {
    const { currency } = input.fees;
    feeBlock = `
<tr>
  <td style="padding:24px 24px 8px;">
    <p style="margin:0 0 12px;font-size:13px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:#666666;">Order summary</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;">
      ${moneyRowHtml('Ticket subtotal', formatMoneyCents(input.fees.subtotal_cents, currency))}
      ${moneyRowHtml(SERVICE_FEE_LABEL, formatMoneyCents(input.fees.platform_fee_cents, currency))}
      ${moneyRowHtml(PROCESSING_FEE_LABEL, formatMoneyCents(input.fees.processing_fee_cents, currency))}
      ${moneyRowHtml('Total paid', formatMoneyCents(input.fees.total_cents, currency), true)}
    </table>
  </td>
</tr>`.trim();
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>Your tickets — 808Tickets</title>
</head>
<body style="margin:0;padding:0;background-color:#0B0B0F;-webkit-text-size-adjust:100%;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">
    Your tickets for ${eventName} are ready on 808Tickets.
  </div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;background-color:#0B0B0F;border-collapse:collapse;">
    <tr>
      <td align="center" style="padding:24px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:560px;border-collapse:collapse;">
          <tr>
            <td align="center" style="padding:8px 8px 20px;">
              <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:22px;font-weight:800;letter-spacing:0.02em;color:#FFFFFF;">808Tickets</p>
            </td>
          </tr>
          <tr>
            <td style="background-color:#FFFFFF;border-radius:16px;overflow:hidden;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;">
                <tr>
                  <td style="padding:28px 24px 8px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
                    <p style="margin:0 0 8px;font-size:13px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:#A25BFF;">Order confirmed</p>
                    <h1 style="margin:0 0 12px;font-size:26px;line-height:1.25;font-weight:800;color:#111111;">You're all set, ${buyer}</h1>
                    <p style="margin:0 0 16px;font-size:16px;line-height:1.5;color:#333333;">Your tickets for <strong style="color:#111111;">${eventName}</strong> are ready.</p>
                    ${metaLines.join('\n')}
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding:20px 24px 8px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
                    <a href="${successUrl}" style="display:inline-block;width:100%;max-width:480px;box-sizing:border-box;padding:16px 24px;background-color:#FF2D78;color:#FFFFFF;font-size:17px;font-weight:700;line-height:1.2;text-align:center;text-decoration:none;border-radius:12px;">${cta}</a>
                  </td>
                </tr>
                <tr>
                  <td style="padding:8px 24px 20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
                    <p style="margin:0;font-size:13px;line-height:1.5;color:#666666;text-align:center;">Open on your phone. From the ticket page you can add to Apple Wallet.</p>
                  </td>
                </tr>
                ${feeBlock}
                <tr>
                  <td style="padding:24px 24px 8px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
                    <p style="margin:0 0 4px;font-size:13px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:#666666;">Your tickets (${input.ticketTotal})</p>
                    <p style="margin:0 0 8px;font-size:13px;line-height:1.5;color:#666666;">Each link opens one mobile ticket with QR code.</p>
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;">
                      ${ticketRows}
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:16px 24px 28px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
                    <p style="margin:0;font-size:13px;line-height:1.55;color:#555555;">Need help? Reply to this email or visit <a href="${successUrl}" style="color:#A25BFF;text-decoration:underline;">your tickets</a> on 808Tickets.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:20px 12px 8px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
              <p style="margin:0 0 6px;font-size:12px;line-height:1.5;color:#9A9AA3;">808Tickets — mobile tickets for independent events</p>
              <p style="margin:0;font-size:12px;line-height:1.5;color:#6E6E78;">This is a transactional email about your order.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function renderOrderConfirmationText(input: OrderEmailTemplateInput): string {
  const parts = [
    `Hi ${input.buyerName},`,
    '',
    `You're all set for ${input.eventName}.`,
  ];

  if (input.dateLine) {
    parts.push(input.dateLine);
  }
  if (input.venueLine) {
    parts.push(input.venueLine);
  }

  parts.push(
    '',
    `You have ${input.ticketTotal} ticket${input.ticketTotal === 1 ? '' : 's'}.`,
    '',
    `${OPEN_TICKETS_CTA_LABEL}: ${input.successUrl}`,
    '',
    'Open tickets on your phone. From the ticket page you can add to Apple Wallet.',
  );

  if (input.fees) {
    const { currency } = input.fees;
    parts.push(
      '',
      'Order summary',
      `Ticket subtotal: ${formatMoneyCents(input.fees.subtotal_cents, currency)}`,
      `${SERVICE_FEE_LABEL}: ${formatMoneyCents(input.fees.platform_fee_cents, currency)}`,
      `${PROCESSING_FEE_LABEL}: ${formatMoneyCents(input.fees.processing_fee_cents, currency)}`,
      `Total paid: ${formatMoneyCents(input.fees.total_cents, currency)}`,
    );
  }

  parts.push('', 'Your tickets:');
  for (const ticket of input.tickets) {
    parts.push(
      `Ticket ${ticket.ticketNumber} of ${ticket.ticketTotal} — ${ticket.passType}`,
      `Open ticket: ${ticket.passUrl}`,
      '',
    );
  }

  parts.push(
    '808Tickets — mobile tickets for independent events',
    'Need help? Reply to this email or open your tickets link above.',
  );

  return parts.join('\n');
}
