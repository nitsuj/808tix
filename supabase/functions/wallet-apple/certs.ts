import forge from 'node-forge';

export type SigningCertificates = {
  wwdr: string;
  signerCert: string;
  signerKey: string;
  signerKeyPassphrase: string;
};

export type ApplePassConfig = {
  passTypeIdentifier: string;
  teamIdentifier: string;
  organizationName: string;
  certificates: SigningCertificates;
};

function requireEnv(name: string): string {
  const value = Deno.env.get(name)?.trim();

  if (!value) {
    throw new Error(`Missing required secret: ${name}`);
  }

  return value;
}

function p12Base64ToPem(p12Base64: string, password: string): { signerCert: string; signerKey: string } {
  const p12Der = forge.util.decode64(p12Base64);
  const p12Asn1 = forge.asn1.fromDer(p12Der);
  const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, password);

  const certBags =
    p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] ?? [];
  const keyBags =
    p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag] ??
    p12.getBags({ bagType: forge.pki.oids.keyBag })[forge.pki.oids.keyBag] ??
    [];

  const certBag = certBags[0];
  const keyBag = keyBags[0];

  if (!certBag?.cert || !keyBag?.key) {
    throw new Error('P12 does not contain a signing certificate and private key.');
  }

  return {
    signerCert: forge.pki.certificateToPem(certBag.cert),
    signerKey: forge.pki.privateKeyToPem(keyBag.key),
  };
}

export function loadApplePassConfig(): ApplePassConfig {
  const passTypeIdentifier = requireEnv('APPLE_PASS_TYPE_IDENTIFIER');
  const teamIdentifier = requireEnv('APPLE_TEAM_ID');
  const organizationName = requireEnv('APPLE_ORGANIZATION_NAME');
  const p12Base64 = requireEnv('APPLE_PASS_CERT_P12_BASE64');
  const signerKeyPassphrase = requireEnv('APPLE_PASS_CERT_PASSWORD');
  const wwdr = requireEnv('APPLE_WWDR_CERT_PEM');

  const { signerCert, signerKey } = p12Base64ToPem(p12Base64, signerKeyPassphrase);

  return {
    passTypeIdentifier,
    teamIdentifier,
    organizationName,
    certificates: {
      wwdr,
      signerCert,
      signerKey,
      signerKeyPassphrase,
    },
  };
}
