import { router, Stack } from 'expo-router';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import Bg from '../../components/Bg';
import { useI18n } from '../../i18n';
import { fonts } from '../../lib/theme';

export default function UserHome() {
  const { t } = useI18n();
  return (
    <Bg>
      <Stack.Screen options={{ title: t('farmer.title') }} />
      <View style={s.container}>
        <Text style={s.heading}>{t('farmer.heading')}</Text>

        <Pressable style={s.card} onPress={() => router.push('/user/camera')}>
          <Image source={require('../../../assets/camera.png')} style={s.icon} resizeMode="contain" />
          <Text style={s.cardTitle}>{t('farmer.newPhoto')}</Text>
          <Text style={s.cardSub}>{t('farmer.newPhotoSub')}</Text>
        </Pressable>

        <Pressable style={[s.card, s.cardAlt]} onPress={() => router.push('/user/records')}>
          <Image source={require('../../../assets/folder.png')} style={s.icon} resizeMode="contain" />
          <Text style={s.cardTitle}>{t('farmer.records')}</Text>
          <Text style={s.cardSub}>{t('farmer.recordsSub')}</Text>
        </Pressable>
      </View>
    </Bg>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'center' },
  heading: { fontSize: 22, fontFamily: fonts.headingBold, color: '#3E5C3A', marginBottom: 24, textAlign: 'center' },
  card: {
    backgroundColor: '#F6F0DF', borderRadius: 18, padding: 26, marginBottom: 16,
    alignItems: 'center', borderWidth: 1, borderColor: '#DDE6C9',
  },
  cardAlt: { backgroundColor: '#F6F0DF' },
  icon: { width: 90, height: 90, marginBottom: 10 },
  cardTitle: { fontSize: 19, fontFamily: fonts.heading, color: '#3E5C3A' },
  cardSub: { fontSize: 13, color: '#7A8B6F', marginTop: 4 },
});
