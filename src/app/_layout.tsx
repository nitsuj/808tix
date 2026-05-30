import { DarkTheme, ThemeProvider, Stack } from 'expo-router';

import { AuthProvider } from '@/contexts/auth-context';

export default function RootLayout() {
  return (
    <AuthProvider>
      <ThemeProvider value={DarkTheme}>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#080808' } }} />
      </ThemeProvider>
    </AuthProvider>
  );
}
