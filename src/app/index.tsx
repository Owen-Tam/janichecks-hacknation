import { router, Stack } from 'expo-router';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import Bg from '../components/Bg';
import { LanguageSwitch } from '../components/LanguageSwitch';
import { useI18n } from '../i18n';
import { fonts } from '../lib/theme';

export default function Home() {
  const { t } = useI18n();
  return (
    <Bg>
      <Stack.Screen options={{ title: 'JaniChecks' }} />
      <View style={s.container}>
        <Image source={require('../../assets/logo.png')} style={s.logo} resizeMode="contain" />
        <Text style={s.subtitle}>{t('home.subtitle')}</Text>

        <Pressable style={s.card} onPress={() => router.push('/user')}>
          <Text style={s.cardTitle}>{t('home.farmer')}</Text>
          <Text style={s.cardSub}>{t('home.farmerSub')}</Text>
        </Pressable>

        <Pressable style={[s.card, s.cardAlt]} onPress={() => router.push('/eo')}>
          <Text style={s.cardTitle}>{t('home.officer')}</Text>
          <Text style={s.cardSub}>{t('home.officerSub')}</Text>
        </Pressable>
        <LanguageSwitch />
      </View>
    </Bg>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 28 },
  logo: { width: 240, height: 116, alignSelf: 'center' },
  subtitle: { fontSize: 15, color: '#7A8B6F', textAlign: 'center', marginBottom: 36 },
  card: {
    backgroundColor: '#F6F0DF', borderRadius: 18, padding: 22, marginBottom: 16,
    borderWidth: 1, borderColor: '#DDE6C9',
  },
  cardAlt: { backgroundColor: '#F6F0DF' },
  cardTitle: { fontSize: 19, fontFamily: fonts.heading, color: '#3E5C3A' },
  cardSub: { fontSize: 13, color: '#7A8B6F', marginTop: 4 },
});
