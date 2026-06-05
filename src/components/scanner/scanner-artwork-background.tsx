import { EventScreenBackground } from '@/components/ui/event-screen-background';

type ScannerArtworkBackgroundProps = {
  eventName: string;
  imageUrl?: string | null;
};

/** Scanner backdrop — delegates to shared EventScreenBackground for full-bleed cover behavior. */
export function ScannerArtworkBackground({ eventName, imageUrl }: ScannerArtworkBackgroundProps) {
  return <EventScreenBackground eventName={eventName} imageUrl={imageUrl} />;
}
