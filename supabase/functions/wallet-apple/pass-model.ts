import { Buffer } from 'node:buffer';
import { PKPass } from 'passkit-generator';

import type { ApplePassConfig } from './certs.ts';
import { walletIcon1x, walletIcon2x, walletIcon3x } from './wallet-assets.ts';

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

function formatEventDateLine(eventDate: string | null, startTime: string | null): string | null {
  if (!eventDate) {
    return null;
  }

  const parsed = new Date(`${eventDate}T${startTime ?? '12:00:00'}`);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  const datePart = parsed.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
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

  return `${datePart} · ${timePart}`;
}

function buildPassJson(pass: PublicPassRow, config: ApplePassConfig): Record<string, unknown> {
  const dateLine = formatEventDateLine(pass.event_date, pass.start_time);
  const auxiliaryFields: Array<{ key: string; label: string; value: string }> = [
    { key: 'guest', label: 'GUEST', value: pass.guest_name },
    { key: 'type', label: 'PASS', value: pass.pass_type },
  ];

  if (dateLine) {
    auxiliaryFields.unshift({ key: 'when', label: 'WHEN', value: dateLine });
  }

  const secondaryFields: Array<{ key: string; label: string; value: string }> = [];

  if (pass.venue_name?.trim()) {
    secondaryFields.push({ key: 'venue', label: 'VENUE', value: pass.venue_name.trim() });
  }

  return {
    formatVersion: 1,
    passTypeIdentifier: config.passTypeIdentifier,
    teamIdentifier: config.teamIdentifier,
    organizationName: config.organizationName,
    description: `${pass.event_name} — 808Tix Pass`,
    serialNumber: pass.secure_token,
    backgroundColor: 'rgb(12, 8, 20)',
    foregroundColor: 'rgb(255, 255, 255)',
    labelColor: 'rgb(196, 181, 253)',
    eventTicket: {
      primaryFields: [{ key: 'event', label: 'EVENT', value: pass.event_name }],
      secondaryFields,
      auxiliaryFields,
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
      'pass.json': Buffer.from(JSON.stringify(passJson)),
    },
    config.certificates,
    {
      serialNumber: pass.secure_token,
      description: `${pass.event_name} — 808Tix Pass`,
      passTypeIdentifier: config.passTypeIdentifier,
      teamIdentifier: config.teamIdentifier,
      organizationName: config.organizationName,
    },
  );

  pkPass.setBarcodes({
    message: pass.secure_token,
    format: 'PKBarcodeFormatQR',
    messageEncoding: 'iso-8859-1',
  });

  const buffer = pkPass.getAsBuffer();
  return new Uint8Array(buffer);
}
