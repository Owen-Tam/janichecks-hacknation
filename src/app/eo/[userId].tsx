import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import Bg from '../../components/Bg';
import { FieldUser, getUsers, plantNameFor } from '../../lib/store';
import { fonts } from '../../lib/theme';

export default function EoUserReport() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const [user, setUser] = useState<FieldUser | null>(null);

  useEffect(() => {
    getUsers().then((all) => setUser(all.find((u) => u.id === userId) ?? null));
  }, [userId]);

  if (!user) return <Bg><View style={s.center}><Text>Inapakia…</Text></View></Bg>;

  const sent = user.records.filter((r) => r.status === 'sent');
  const confirmed = user.records.filter((r) => r.status === 'confirmed').length;

  return (
    <Bg>
      <Stack.Screen options={{ title: 'Ripoti ya Shamba' }} />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
        <View style={s.reportHead}>
          <Text style={s.reportTitle}>{user.name}</Text>
          <Text style={s.reportMeta}>{user.village} · {user.crop}</Text>
        </View>

        <View style={s.stats}>
          <View style={s.stat}><Text style={s.statNum}>{user.plants.length}</Text><Text style={s.statLabel}>Mimea Imetambuliwa</Text></View>
          <View style={s.stat}><Text style={s.statNum}>{confirmed}</Text><Text style={s.statLabel}>Imethibitishwa</Text></View>
          <View style={s.stat}><Text style={s.statNum}>{sent.length}</Text><Text style={s.statLabel}>Zimetumwa Kwako</Text></View>
        </View>

        <Text style={s.section}>Rekodi Zilizotumwa</Text>
        {sent.length === 0 && <Text style={s.muted}>Hakuna rekodi zilizotumwa bado.</Text>}
        {sent.map((r) => (
          <View key={r.id} style={s.card}>
            {r.imageUri ? (
              <Image source={{ uri: r.imageUri }} style={s.image} />
            ) : (
              <View style={[s.image, s.placeholder]}><Text style={{ fontSize: 30 }}>🌿</Text></View>
            )}
            <View style={s.rowBetween}>
              <Text style={s.plantName}>{plantNameFor(user, r.plantId)}</Text>
              <View style={[s.pill, { flexDirection: 'row', alignItems: 'center', gap: 6 }]}>
                <Image source={require('../../../assets/letter.png')} style={{ width: 26, height: 26 }} resizeMode="contain" />
                <Text style={s.pillText}>Imetumwa</Text>
              </View>
            </View>
            <Text style={s.meta}>{r.date}</Text>
            {!!r.note && <Text style={s.note}>{r.note}</Text>}
          </View>
        ))}
      </ScrollView>
    </Bg>
  );
}

const s = StyleSheet.create({
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
  image: { width: '100%', height: 140, borderRadius: 12, marginBottom: 12 },
  placeholder: { backgroundColor: '#EAF3DC', justifyContent: 'center', alignItems: 'center' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  plantName: { fontSize: 16, fontFamily: fonts.heading, color: '#3E5C3A' },
  meta: { fontSize: 12, color: '#8A9A7C', marginTop: 2 },
  note: { fontSize: 13, color: '#5C6B52', marginTop: 6 },
  pill: { backgroundColor: '#ECBA9A', paddingVertical: 4, paddingHorizontal: 10, borderRadius: 999 },
  pillText: { fontSize: 12, fontFamily: fonts.bodySemi, color: '#FFFFFF' },
});
