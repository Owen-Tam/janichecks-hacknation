import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AdviceReport, DiagnosisLine } from '../../components/AdviceReport';
import Bg from '../../components/Bg';
import { storedText, useI18n } from '../../i18n';
import { pairedDisease } from '../../lib/leafModel';
import { recordImage } from '../../lib/samples';
import { FieldUser, getUsers, plantNameFor } from '../../lib/store';
import { fonts } from '../../lib/theme';

export default function EoUserReport() {
  const { t } = useI18n();
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const [user, setUser] = useState<FieldUser | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    getUsers().then((all) => setUser(all.find((u) => u.id === userId) ?? null));
  }, [userId]);

  if (!user) return <Bg><View style={s.center}><Text>{t('officer.loading')}</Text></View></Bg>;

  const sent = user.records.filter((r) => r.status === 'sent');
  const confirmed = user.records.filter((r) => r.status === 'confirmed').length;
  const open = sent.find((r) => r.id === openId) ?? null;

  if (open) {
    return (
      <ScrollView style={s.container} contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
        <Stack.Screen options={{ title: t('officer.recordTitle', { name: user.name }) }} />
        {recordImage(open.imageUri) ? (
          <Image source={recordImage(open.imageUri)!} style={s.image} />
        ) : (
          <View style={[s.image, s.placeholder]}><Text style={{ fontSize: 30 }}>🌿</Text></View>
        )}
        <Text style={s.plantName}>{storedText(plantNameFor(user, open.plantId), t)}</Text>
        <Text style={s.meta}>{open.date}</Text>
        {!!open.note && <Text style={s.note}>{storedText(open.note, t)}</Text>}
        <View style={s.reportCard}>
          {open.diagnosis ? (
            <AdviceReport
              label={open.diagnosis.label}
              status={open.diagnosis.status}
              also={pairedDisease(open.diagnosis.status, open.diagnosis.also, open.diagnosis.probs)}
              date={open.date}
            />
          ) : (
            <Text style={s.muted}>{t('officer.noDiagnosis')}</Text>
          )}
        </View>
        <Pressable style={s.back} onPress={() => setOpenId(null)}>
          <Text style={s.backText}>{t('officer.back')}</Text>
        </Pressable>
      </ScrollView>
    );
  }

  return (
    <Bg>
      <Stack.Screen options={{ title: t('officer.report') }} />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
        <View style={s.reportHead}>
          <Text style={s.reportTitle}>{user.name}</Text>
          <Text style={s.reportMeta}>{user.village} · {storedText(user.crop, t)}</Text>
        </View>

        <View style={s.stats}>
          <View style={s.stat}><Text style={s.statNum}>{user.plants.length}</Text><Text style={s.statLabel}>{t('officer.plants')}</Text></View>
          <View style={s.stat}><Text style={s.statNum}>{confirmed}</Text><Text style={s.statLabel}>{t('officer.confirmed')}</Text></View>
          <View style={s.stat}><Text style={s.statNum}>{sent.length}</Text><Text style={s.statLabel}>{t('officer.sentToYou')}</Text></View>
        </View>

        <Text style={s.section}>{t('officer.sentRecords')}</Text>
        {sent.length === 0 && <Text style={s.muted}>{t('officer.none')}</Text>}
        {sent.map((r) => (
          <Pressable key={r.id} style={s.card} onPress={() => setOpenId(r.id)}>
            {recordImage(r.imageUri) ? (
              <Image source={recordImage(r.imageUri)!} style={s.image} />
            ) : (
              <View style={[s.image, s.placeholder]}><Text style={{ fontSize: 30 }}>🌿</Text></View>
            )}
            <View style={s.rowBetween}>
              <Text style={s.plantName}>{storedText(plantNameFor(user, r.plantId), t)}</Text>
              <View style={[s.pill, { flexDirection: 'row', alignItems: 'center', gap: 6 }]}>
                <Image source={require('../../../assets/letter.png')} style={{ width: 26, height: 26 }} resizeMode="contain" />
                <Text style={s.pillText}>{t('officer.sent')}</Text>
              </View>
            </View>
            <Text style={s.meta}>{r.date}</Text>
            {r.diagnosis && (
              <DiagnosisLine
                label={r.diagnosis.label}
                status={r.diagnosis.status}
                also={pairedDisease(r.diagnosis.status, r.diagnosis.also, r.diagnosis.probs)}
              />
            )}
            {!!r.note && <Text style={s.note}>{storedText(r.note, t)}</Text>}
          </Pressable>
        ))}
      </ScrollView>
    </Bg>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  reportHead: { backgroundColor: '#E19672', borderRadius: 16, padding: 18, marginBottom: 16 },
  reportTitle: { color: '#FFFFFF', fontSize: 20, fontFamily: fonts.headingBold },
  reportMeta: { color: '#EAF3DC', fontSize: 13, marginTop: 4 },
  stats: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  stat: { flex: 1, backgroundColor: '#F6F0DF', borderRadius: 14, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: '#DDE6C9' },
  statNum: { fontSize: 22, fontFamily: fonts.headingBold, color: '#3E5C3A' },
  statLabel: { fontSize: 11, color: '#8A9A7C', marginTop: 2, textAlign: 'center' },
  section: { fontSize: 16, fontFamily: fonts.headingBold, color: '#3E5C3A', marginBottom: 12 },
  muted: { color: '#8A9A7C', fontSize: 14 },
  card: { backgroundColor: '#F6F0DF', borderRadius: 16, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: '#DDE6C9' },
  reportCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginTop: 14, borderWidth: 1, borderColor: '#DDE6C9' },
  image: { width: '100%', height: 140, borderRadius: 12, marginBottom: 12 },
  placeholder: { backgroundColor: '#EAF3DC', justifyContent: 'center', alignItems: 'center' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  plantName: { fontSize: 16, fontFamily: fonts.heading, color: '#3E5C3A' },
  meta: { fontSize: 12, color: '#8A9A7C', marginTop: 2 },
  note: { fontSize: 13, color: '#5C6B52', marginTop: 6 },
  pill: { backgroundColor: '#ECBA9A', paddingVertical: 4, paddingHorizontal: 10, borderRadius: 999 },
  pillText: { fontSize: 12, fontFamily: fonts.bodySemi, color: '#FFFFFF' },
  back: { backgroundColor: '#EAF3DC', borderRadius: 12, paddingVertical: 12, alignItems: 'center', marginTop: 16 },
  backText: { color: '#3E5C3A', fontFamily: fonts.bodySemi },
});
