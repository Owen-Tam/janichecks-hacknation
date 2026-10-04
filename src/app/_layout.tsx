import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: '#F3F6E8' },
          headerTintColor: '#3E5C3A',
          headerTitleStyle: { fontWeight: '600' },
          contentStyle: { backgroundColor: '#F3F6E8' },
          headerShadowVisible: false,
        }}
      />
    </>
  );
}
