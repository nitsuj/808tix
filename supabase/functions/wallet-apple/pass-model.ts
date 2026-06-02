import { Buffer } from 'node:buffer';
import { PKPass } from 'passkit-generator';

import type { ApplePassConfig } from './certs.ts';
import {
  walletIcon1x,
  walletIcon2x,
  walletIcon3x,
  walletLogo1x,
  walletLogo2x,
  walletLogo3x,
  walletStrip1x,
  walletStrip2x,
  walletStrip3x,
} from './wallet-assets.ts';

export type PublicPassRow = {
  guest_name: string;
  pass_type: string;
  status: string;
  secure_token: string;
  event_name: string;
  event_slug: string;
  venue_name: string | null;
  event_date: string | null;
  start_time: string | null;
  description: string | null;
  image_url: string | null;
};

/** Fan pass palette — matches src/theme/colors.ts */
const WALLET_COLORS = {
  background: 'rgb(8, 6, 18)',
  foreground: 'rgb(255, 255, 255)',
  label: 'rgb(226, 204, 255)',
  accent: 'rgb(162, 91, 255)',
} as const;

type PassField = {
  key: string;
  label: string;
  value: string;
  textAlignment?: string;
};

function truncate(value: string, max: number): string {
  const trimmed = value.trim();

  if (trimmed.length <= max) {
    return trimmed;
  }

  return `${trimmed.slice(0, max - 1)}…`;
}

function formatHeaderWhenLine(eventDate: string | null, startTime: string | null): string | null {
  if (!eventDate) {
    return null;
  }

  const parsed = new Date(`${eventDate}T${startTime ?? '12:00:00'}`);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  const weekday = parsed.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
  const monthDay = parsed
    .toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    .toUpperCase()
    .replace('.', '');
  const year = parsed.getFullYear();

  if (!startTime) {
    return `${weekday} · ${monthDay} · ${year}`;
  }

  const time = parsed
    .toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
    .toUpperCase()
    .replace(/\s/g, '');

  return `${weekday} · ${monthDay} · ${year} · ${time}`;
}

function formatBackWhenLine(eventDate: string | null, startTime: string | null): string | null {
  if (!eventDate) {
    return null;
  }

  const parsed = new Date(`${eventDate}T${startTime ?? '12:00:00'}`);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  const datePart = parsed.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  if (!startTime) {
    return datePart;
  }

  const timePart = parsed.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  return `${datePart} at ${timePart}`;
}

function buildPassJson(pass: PublicPassRow, config: ApplePassConfig): Record<string, unknown> {
  const headerWhen = formatHeaderWhenLine(pass.event_date, pass.start_time);
  const backWhen = formatBackWhenLine(pass.event_date, pass.start_time);
  const venue = pass.venue_name?.trim() ?? '';
  const passType = truncate(pass.pass_type || 'General Admission', 28);
  const guestName = truncate(pass.guest_name, 32);
  const eventName = truncate(pass.event_name, 42);

  const headerFields: PassField[] = [];

  if (headerWhen) {
    headerFields.push({
      key: 'when',
      label: 'WHEN',
      value: headerWhen,
      textAlignment: 'PKTextAlignmentRight',
    });
  }

  const secondaryFields: PassField[] = [];

  if (venue) {
    secondaryFields.push({
      key: 'venue',
      label: 'VENUE',
      value: truncate(venue, 36),
    });
  }

  const auxiliaryFields: PassField[] = [
    { key: 'guest', label: 'GUEST', value: guestName },
    { key: 'type', label: 'PASS TYPE', value: passType },
  ];

  const backFields: PassField[] = [
    {
      key: 'brand',
      label: '808Tix',
      value: 'Present this QR at the door for entry.',
    },
    { key: 'event', label: 'EVENT', value: pass.event_name },
    { key: 'guest', label: 'GUEST', value: pass.guest_name },
    { key: 'pass', label: 'PASS TYPE', value: pass.pass_type },
  ];

  if (backWhen) {
    backFields.splice(1, 0, { key: 'datetime', label: 'DATE & TIME', value: backWhen });
  }

  if (venue) {
    backFields.splice(backWhen ? 2 : 1, 0, { key: 'venue', label: 'VENUE', value: venue });
  }

  if (pass.description?.trim()) {
    backFields.push({
      key: 'notes',
      label: 'DETAILS',
      value: truncate(pass.description.trim(), 220),
    });
  }

  return {
    formatVersion: 1,
    passTypeIdentifier: config.passTypeIdentifier,
    teamIdentifier: config.teamIdentifier,
    organizationName: config.organizationName,
    logoText: '808Tix',
    description: `${pass.event_name} — 808Tix Pass`,
    serialNumber: pass.secure_token,
    backgroundColor: WALLET_COLORS.background,
    foregroundColor: WALLET_COLORS.foreground,
    labelColor: WALLET_COLORS.label,
    eventTicket: {
      headerFields,
      primaryFields: [{ key: 'event', label: 'EVENT', value: eventName }],
      secondaryFields,
      auxiliaryFields,
      backFields,
    },
  };
}

export function buildSignedPkpass(pass: PublicPassRow, config: ApplePassConfig): Uint8Array {
  const passJson = buildPassJson(pass, config);

  const pkPass = new PKPass(
    {
      'icon.png': Buffer.from(walletIcon1x),
      'icon@2x.png': Buffer.from(walletIcon2x),
      'icon@3x.png': Buffer.from(walletIcon3x),
      'logo.png': Buffer.from(walletLogo1x),
      'logo@2x.png': Buffer.from(walletLogo2x),
      'logo@3x.png': Buffer.from(walletLogo3x),
      'strip.png': Buffer.from(walletStrip1x),
      'strip@2x.png': Buffer.from(walletStrip2x),
      'strip@3x.png': Buffer.from(walletStrip3x),
      'pass.json': Buffer.from(JSON.stringify(passJson)),
    },
    config.certificates,
    {
      serialNumber: pass.secure_token,
      description: `${pass.event_name} — 808Tix Pass`,
      passTypeIdentifier: config.passTypeIdentifier,
      teamIdentifier: config.teamIdentifier,
      organizationName: config.organizationName,
      logoText: '808Tix',
    },
  );

  pkPass.setBarcodes({
    message: pass.secure_token,
    format: 'PKBarcodeFormatQR',
    messageEncoding: 'iso-8859-1',
    altText: '808Tix entry QR',
  });

  const buffer = pkPass.getAsBuffer();
  return new Uint8Array(buffer);
}
