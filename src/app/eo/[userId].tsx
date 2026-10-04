import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { FieldUser, getUsers, plantNameFor } from '../../lib/store';

export default function EoUserReport() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const [user, setUser] = useState<FieldUser | null>(null);

  useEffect(() => {
    getUsers().then((all) => setUser(all.find((u) => u.id === userId) ?? null));
  }, [userId]);

  if (!user) return <View style={s.center}><Text>Loading…</Text></View>;

  const sent = user.records.filter((r) => r.status === 'sent');
  const confirmed = user.records.filter((r) => r.status === 'confirmed').length;

  return (
    <ScrollView style={s.container} contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
      <Stack.Screen options={{ title: `${user.name} — Report` }} />

      <View style={s.reportHead}>
        <Text style={s.reportTitle}>Field Report</Text>
        <Text style={s.reportMeta}>{user.name} · {user.village} · {user.crop}</Text>
      </View>

      <View style={s.stats}>
        <View style={s.stat}><Text style={s.statNum}>{user.plants.length}</Text><Text style={s.statLabel}>Plants ID’d</Text></View>
        <View style={s.stat}><Text style={s.statNum}>{confirmed}</Text><Text style={s.statLabel}>Confirmed</Text></View>
        <View style={s.stat}><Text style={s.statNum}>{sent.length}</Text><Text style={s.statLabel}>Sent to you</Text></View>
      </View>

      <Text style={s.section}>Sent Records</Text>
      {sent.length === 0 && <Text style={s.muted}>No records sent yet.</Text>}
      {sent.map((r) => (
        <View key={r.id} style={s.card}>
          {r.imageUri ? (
            <Image source={{ uri: r.imageUri }} style={s.image} />
          ) : (
            <View style={[s.image, s.placeholder]}><Text style={{ fontSize: 30 }}>🌿</Text></View>
          )}
          <View style={s.rowBetween}>
            <Text style={s.plantName}>{plantNameFor(user, r.plantId)}</Text>
            <View style={s.pill}><Text style={s.pillText}>📨 Sent</Text></View>
          </View>
          <Text style={s.meta}>{r.date}</Text>
          {!!r.note && <Text style={s.note}>{r.note}</Text>}
        </View>
      ))}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F6E8' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F3F6E8' },
  reportHead: { backgroundColor: '#7FB069', borderRadius: 16, padding: 18, marginBottom: 16 },
  reportTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: '700' },
  reportMeta: { color: '#EAF3DC', fontSize: 13, marginTop: 4 },
  stats: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  stat: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: '#DDE6C9' },
  statNum: { fontSize: 22, fontWeight: '700', color: '#3E5C3A' },
  statLabel: { fontSize: 11, color: '#8A9A7C', marginTop: 2 },
  section: { fontSize: 16, fontWeight: '700', color: '#3E5C3A', marginBottom: 12 },
  muted: { color: '#8A9A7C', fontSize: 14 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: '#DDE6C9' },
  image: { width: '100%', height: 140, borderRadius: 12, marginBottom: 12 },
  placeholder: { backgroundColor: '#EAF3DC', justifyContent: 'center', alignItems: 'center' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  plantName: { fontSize: 16, fontWeight: '600', color: '#3E5C3A' },
  meta: { fontSize: 12, color: '#8A9A7C', marginTop: 2 },
  note: { fontSize: 13, color: '#5C6B52', marginTop: 6 },
  pill: { backgroundColor: '#D8E9C5', paddingVertical: 4, paddingHorizontal: 10, borderRadius: 999 },
  pillText: { fontSize: 12, fontWeight: '600', color: '#3E5C3A' },
});
