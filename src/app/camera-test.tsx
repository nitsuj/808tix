import { StyleSheet, Text, View } from 'react-native';

export default function CameraTestScreen() {
  return (
    <View style={styles.page}>
      <Text style={styles.title}>Camera test is web-only</Text>
      <Text style={styles.body}>Open /camera-test in a browser with Expo web running.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    alignItems: 'center',
    backgroundColor: '#111111',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  body: {
    color: '#b0b4ba',
    fontSize: 16,
    textAlign: 'center',
  },
});
