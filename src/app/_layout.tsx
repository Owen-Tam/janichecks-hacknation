import { useFonts } from 'expo-font';
import { Fraunces_600SemiBold, Fraunces_700Bold } from '@expo-google-fonts/fraunces';
import { Sora_400Regular, Sora_600SemiBold } from '@expo-google-fonts/sora';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Text } from 'react-native';
import { I18nProvider, useI18n } from '../i18n';
import { fonts } from '../lib/theme';

(Text as { defaultProps?: { style?: object } }).defaultProps = {
  style: { fontFamily: fonts.body },
};

export default function RootLayout() {
  const [loaded] = useFonts({
    Fraunces_600SemiBold,
    Fraunces_700Bold,
    Sora_400Regular,
    Sora_600SemiBold,
  });

  if (!loaded) return null;

  return (
    <I18nProvider>
      <AppStack />
    </I18nProvider>
  );
}

function AppStack() {
  const { t } = useI18n();
  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: '#F3F6E8' },
          headerTintColor: '#3E5C3A',
          headerTitleStyle: { fontFamily: fonts.heading },
          contentStyle: { backgroundColor: '#F3F6E8' },
          headerBackTitle: t('common.back'),
          headerBackTitleStyle: { fontFamily: 'Sora_400Regular' },
          headerShadowVisible: false,
        }}
      />
    </>
  );
}
