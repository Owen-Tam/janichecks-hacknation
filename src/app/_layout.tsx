import { useFonts } from 'expo-font';
import { Fraunces_600SemiBold, Fraunces_700Bold } from '@expo-google-fonts/fraunces';
import { Sora_400Regular, Sora_600SemiBold } from '@expo-google-fonts/sora';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Text } from 'react-native';
import { fonts } from '../lib/theme';

export default function RootLayout() {
  const [loaded] = useFonts({
    Fraunces_600SemiBold,
    Fraunces_700Bold,
    Sora_400Regular,
    Sora_600SemiBold,
  });

  if (!loaded) return null;

  (Text as any).defaultProps = {
    ...(Text as any).defaultProps,
    style: { fontFamily: fonts.body },
  };

  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: '#F3F6E8' },
          headerTintColor: '#3E5C3A',
          headerTitleStyle: { fontFamily: fonts.heading },
          contentStyle: { backgroundColor: '#F3F6E8' },
          headerBackTitle: 'Nyuma',
          headerBackTitleStyle: { fontFamily: 'Sora_400Regular' },
          headerShadowVisible: false,
        }}
      />
    </>
  );
}
