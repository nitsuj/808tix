import {
  LegalBulletList,
  LegalDocumentScreen,
  LegalParagraph,
  LegalSection,
} from '@/components/legal/legal-document-screen';
import { LEGAL_COMPANY_NAME, LEGAL_CONTACT_EMAIL } from '@/lib/legal-content';

export default function PrivacyPolicyScreen() {
  return (
    <LegalDocumentScreen title="Privacy Policy">
      <LegalSection heading="Overview">
        <LegalParagraph>
          {LEGAL_COMPANY_NAME} helps independent event organizers issue digital passes, deliver them
          to guests, and validate entry at the door. This Privacy Policy describes how we collect,
          use, and share information when you use our services.
        </LegalParagraph>
        <LegalParagraph>
          This document is provided for MVP launch and SMS compliance. It is not legal advice.
          Replace placeholder contact details before production launch.
        </LegalParagraph>
      </LegalSection>

      <LegalSection heading="Information we collect">
        <LegalParagraph>We may collect the following categories of information:</LegalParagraph>
        <LegalBulletList
          items={[
            'Organizer account information — email address, password (stored by our auth provider), and profile identifiers used to sign in and manage events.',
            'Guest pass information — guest first and last name (stored as a combined name), pass type, pass status, and secure pass token used for QR validation.',
            'Contact details for pass delivery — guest email address and/or phone number when an organizer issues a pass.',
            'Event information — event name, venue, date, time, description, and artwork you provide as an organizer.',
            'Check-in records — scan results, timestamps, and the organizer account that performed validation.',
            'Technical data — device/browser type, IP address, and service logs collected by our hosting and messaging providers.',
          ]}
        />
      </LegalSection>

      <LegalSection heading="How we use information">
        <LegalParagraph>We use collected information to:</LegalParagraph>
        <LegalBulletList
          items={[
            'Provide account access and authenticate organizers.',
            'Enable event creation, pass issuance, and pass list management.',
            'Display guest passes on mobile web and generate Apple Wallet passes when requested.',
            'Deliver pass links and notifications, including SMS messages sent on behalf of organizers.',
            'Validate passes at entry using QR codes and prevent duplicate check-ins.',
            'Operate, secure, and improve the service.',
            'Comply with legal obligations and respond to support requests.',
          ]}
        />
      </LegalSection>

      <LegalSection heading="SMS messaging">
        <LegalParagraph>
          When an organizer sends a pass link by SMS, the message is delivered through our SMS
          provider on behalf of the organizer. Message and data rates may apply.
        </LegalParagraph>
        <LegalParagraph>
          Recipients may reply STOP to opt out of further SMS messages from that sender number.
          Reply HELP for assistance.
        </LegalParagraph>
        <LegalParagraph>
          SMS is used for transactional pass delivery, not marketing, unless you separately obtain
          appropriate consent for promotional messages.
        </LegalParagraph>
      </LegalSection>

      <LegalSection heading="Third-party providers">
        <LegalParagraph>
          We use trusted service providers to operate {LEGAL_COMPANY_NAME}. These may include:
        </LegalParagraph>
        <LegalBulletList
          items={[
            'Supabase — authentication, database, file storage, and serverless functions.',
            'Twilio — SMS delivery for pass links when configured by an organizer.',
            'Apple Wallet — generation of signed .pkpass files when a guest adds a pass to Wallet (Apple platform terms apply).',
            'Stripe (future) — payment processing if and when ticketing payments are enabled.',
            'Vercel — web hosting for the public guest pass experience.',
          ]}
        />
        <LegalParagraph>
          These providers process data on our behalf under their own terms and privacy policies.
        </LegalParagraph>
      </LegalSection>

      <LegalSection heading="Data retention">
        <LegalParagraph>
          We retain organizer account and event data while your account is active and as needed to
          provide the service. Pass and check-in records may be retained for operational, security,
          and dispute-resolution purposes.
        </LegalParagraph>
        <LegalParagraph>
          You may request deletion of your organizer account by contacting us. Some records may be
          retained where required by law or for legitimate business purposes (for example, audit logs
          or completed event check-in history).
        </LegalParagraph>
      </LegalSection>

      <LegalSection heading="Security">
        <LegalParagraph>
          We use industry-standard measures including encrypted connections, access controls, and
          provider security features. No method of transmission or storage is 100% secure.
        </LegalParagraph>
      </LegalSection>

      <LegalSection heading="Contact">
        <LegalParagraph>
          Questions about this Privacy Policy or our data practices: {LEGAL_CONTACT_EMAIL}
        </LegalParagraph>
      </LegalSection>
    </LegalDocumentScreen>
  );
}
