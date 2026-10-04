import { Stack, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import Bg from '../../components/Bg';
import { CURRENT_USER_ID, FieldUser, getUsers, plantNameFor, saveUsers } from '../../lib/store';
import { fonts } from '../../lib/theme';

export default function Records() {
  const [user, setUser] = useState<FieldUser | null>(null);

  useFocusEffect(
    useCallback(() => {
      getUsers().then((all) => setUser(all.find((u) => u.id === CURRENT_USER_ID) ?? null));
    }, [])
  );

  async function setStatus(recordId: string, status: 'confirmed' | 'sent') {
    const all = await getUsers();
    const next = all.map((u) =>
      u.id !== CURRENT_USER_ID
        ? u
        : { ...u, records: u.records.map((r) => (r.id === recordId ? { ...r, status } : r)) }
    );
    await saveUsers(next);
    setUser(next.find((u) => u.id === CURRENT_USER_ID) ?? null);
    if (status === 'sent') Alert.alert('Imetumwa ✓', 'Rekodi hii imetumwa kwa Afisa wako wa Ugani.');
  }

  if (!user) return <Bg><View style={s.center}><Text style={s.muted}>Inapakia…</Text></View></Bg>;

  const sorted = [...user.records].sort((a, b) => (a.date < b.date ? 1 : -1));

  return (
    <Bg>
      <Stack.Screen options={{ title: 'Rekodi za Awali' }} />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
        <Text style={s.heading}>Rekodi za Awali</Text>
        {sorted.length === 0 && <Text style={s.muted}>Hakuna rekodi bado. Piga picha kuanza.</Text>}
        {sorted.map((r) => (
          <View key={r.id} style={s.card}>
            {r.imageUri ? (
              <Image source={{ uri: r.imageUri }} style={s.image} />
            ) : (
              <View style={[s.image, s.placeholder]}><Text style={{ fontSize: 34 }}>🌿</Text></View>
            )}
            <Text style={s.plantName}>{plantNameFor(user, r.plantId)}</Text>
            <Text style={s.meta}>{r.date}</Text>
            {!!r.note && <Text style={s.note}>{r.note}</Text>}

            <View style={s.row}>
              {r.status === 'pending' && (
                <Pressable style={s.btn} onPress={() => setStatus(r.id, 'confirmed')}>
                  <Text style={s.btnText}>Thibitisha</Text>
                </Pressable>
              )}
              {r.status === 'confirmed' && (
                <>
                  <View style={[s.badge, s.badgeConfirmed]}><Text style={s.badgeText}>✓ Imethibitishwa</Text></View>
                  <Pressable style={s.btn} onPress={() => setStatus(r.id, 'sent')}>
                    <Text style={s.btnText}>Tuma kwa Afisa</Text>
                  </Pressable>
                </>
              )}
              {r.status === 'sent' && (
                <View style={[s.badge, s.badgeSent, { flexDirection: 'row', alignItems: 'center', gap: 6 }]}>
                  <Image source={require('../../../assets/letter.png')} style={{ width: 28, height: 28 }} resizeMode="contain" />
                  <Text style={[s.badgeText, { color: '#FFFFFF' }]}>Imetumwa kwa Afisa wa Ugani</Text>
                </View>
              )}
            </View>
          </View>
        ))}
      </ScrollView>
    </Bg>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  heading: { fontSize: 22, fontFamily: fonts.headingBold, color: '#3E5C3A', marginBottom: 16 },
  muted: { color: '#8A9A7C', fontSize: 14 },
  card: { backgroundColor: '#F6F0DF', borderRadius: 16, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: '#DDE6C9' },
  image: { width: '100%', height: 150, borderRadius: 12, marginBottom: 12 },
  placeholder: { backgroundColor: '#EAF3DC', justifyContent: 'center', alignItems: 'center' },
  plantName: { fontSize: 17, fontFamily: fonts.heading, color: '#3E5C3A' },
  meta: { fontSize: 12, color: '#8A9A7C', marginTop: 2 },
  note: { fontSize: 13, color: '#5C6B52', marginTop: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  btn: { backgroundColor: '#F6F0DF', paddingVertical: 9, paddingHorizontal: 18, borderRadius: 12, borderWidth: 1, borderColor: '#E4D9B8' },
  btnText: { color: '#3E5C3A', fontFamily: fonts.bodySemi, fontSize: 14 },
  badge: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999 },
  badgeConfirmed: { backgroundColor: '#EAF3DC' },
  badgeSent: { backgroundColor: '#ECBA9A' },
  badgeText: { color: '#3E5C3A', fontFamily: fonts.bodySemi, fontSize: 13 },
});
