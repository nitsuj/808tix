import * as Clipboard from 'expo-clipboard';
import { Platform } from 'react-native';

export async function copyToClipboard(text: string): Promise<void> {
  if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  await Clipboard.setStringAsync(text);
}
