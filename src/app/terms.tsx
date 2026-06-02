import {
  LegalBulletList,
  LegalDocumentScreen,
  LegalParagraph,
  LegalSection,
} from '@/components/legal/legal-document-screen';
import { LEGAL_COMPANY_NAME, LEGAL_CONTACT_EMAIL } from '@/lib/legal-content';

export default function TermsOfServiceScreen() {
  return (
    <LegalDocumentScreen title="Terms of Service">
      <LegalSection heading="Agreement">
        <LegalParagraph>
          By accessing or using {LEGAL_COMPANY_NAME}, you agree to these Terms of Service. If you do
          not agree, do not use the service.
        </LegalParagraph>
        <LegalParagraph>
          These terms apply to organizers who create accounts and manage events, and to guests who
          receive and use digital passes. This document is an MVP implementation and is not legal
          advice.
        </LegalParagraph>
      </LegalSection>

      <LegalSection heading="Service description">
        <LegalParagraph>
          {LEGAL_COMPANY_NAME} provides tools for independent event organizers to create events,
          issue digital passes, share pass links, optionally deliver passes via SMS or Apple Wallet,
          and validate entry using QR scanning at the door.
        </LegalParagraph>
        <LegalParagraph>
          The service is provided on an as-available basis during the MVP period. Features may
          change, be added, or be removed without notice.
        </LegalParagraph>
      </LegalSection>

      <LegalSection heading="Organizer responsibilities">
        <LegalParagraph>As an organizer, you agree to:</LegalParagraph>
        <LegalBulletList
          items={[
            'Provide accurate event information and maintain control of your account credentials.',
            'Issue passes only to guests you are authorized to admit.',
            'Obtain any required consent before collecting guest email or phone numbers.',
            'Comply with applicable laws for your events, venues, and messaging (including SMS and privacy laws).',
            'Use the scanner and check-in tools responsibly and only for your events.',
            'Not use the service for unlawful, fraudulent, or harmful activities.',
          ]}
        />
      </LegalSection>

      <LegalSection heading="Ticket and pass delivery">
        <LegalParagraph>
          Passes are delivered electronically via shareable links, SMS (when enabled), or Apple
          Wallet (when supported). Delivery depends on guest devices, carriers, and third-party
          services outside our control.
        </LegalParagraph>
        <LegalParagraph>
          {LEGAL_COMPANY_NAME} does not guarantee that every guest will receive or open a pass link.
          Organizers are responsible for confirming guest contact details before sending SMS.
        </LegalParagraph>
      </LegalSection>

      <LegalSection heading="Scanner validation">
        <LegalParagraph>
          QR validation determines whether a pass is accepted for entry based on pass status, event
          match, and prior check-in state. Scan results are provided for operational use at the door.
        </LegalParagraph>
        <LegalParagraph>
          Organizers are responsible for door operations and final admission decisions at their
          events.
        </LegalParagraph>
      </LegalSection>

      <LegalSection heading="Prohibited use">
        <LegalParagraph>You may not:</LegalParagraph>
        <LegalBulletList
          items={[
            'Reverse engineer, abuse, or attempt to bypass pass security or rate limits.',
            'Use the service to send spam, unsolicited marketing SMS, or harassing messages.',
            'Upload unlawful content or impersonate others.',
            'Resell or sublicense the service without permission.',
            'Interfere with service availability or other users\' access.',
          ]}
        />
      </LegalSection>

      <LegalSection heading="Limitation of liability">
        <LegalParagraph>
          To the maximum extent permitted by law, {LEGAL_COMPANY_NAME} and its operators are not
          liable for indirect, incidental, special, consequential, or punitive damages, or for lost
          profits, data, or goodwill arising from your use of the service.
        </LegalParagraph>
        <LegalParagraph>
          Our total liability for any claim related to the service is limited to the amount you paid
          us in the twelve (12) months before the claim, or one hundred U.S. dollars (USD $100) if
          no fees were paid, whichever is greater.
        </LegalParagraph>
      </LegalSection>

      <LegalSection heading="Account termination">
        <LegalParagraph>
          You may stop using the service at any time. We may suspend or terminate access if you
          violate these terms, create security risk, or as required by law or our providers.
        </LegalParagraph>
        <LegalParagraph>
          Upon termination, your right to use the service ends. Provisions that by nature should
          survive (including liability limits) will continue to apply.
        </LegalParagraph>
      </LegalSection>

      <LegalSection heading="Changes">
        <LegalParagraph>
          We may update these Terms from time to time. Continued use after changes are posted
          constitutes acceptance of the updated Terms.
        </LegalParagraph>
      </LegalSection>

      <LegalSection heading="Contact">
        <LegalParagraph>
          Questions about these Terms: {LEGAL_CONTACT_EMAIL}
        </LegalParagraph>
      </LegalSection>
    </LegalDocumentScreen>
  );
}
