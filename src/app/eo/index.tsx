import { Stack, router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { FieldUser, getUsers } from '../../lib/store';

export default function EoHome() {
  const [users, setUsers] = useState<FieldUser[]>([]);
  useFocusEffect(useCallback(() => { getUsers().then(setUsers); }, []));

  return (
    <ScrollView style={s.container} contentContainerStyle={{ padding: 20 }}>
      <Stack.Screen options={{ title: 'Your Farmers' }} />
      <Text style={s.heading}>Users in your charge</Text>
      {users.map((u) => {
        const sent = u.records.filter((r) => r.status === 'sent').length;
        return (
          <Pressable key={u.id} style={s.card} onPress={() => router.push({ pathname: '/eo/[userId]', params: { userId: u.id } })}>
            <View style={s.avatar}><Text style={s.avatarText}>{u.name.split(' ').map((n) => n[0]).join('')}</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={s.name}>{u.name}</Text>
              <Text style={s.meta}>{u.village} · {u.crop}</Text>
            </View>
            <View style={[s.pill, sent > 0 ? s.pillHot : s.pillEmpty]}>
              <Text style={s.pillText}>{sent} sent</Text>
            </View>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F6E8' },
  heading: { fontSize: 22, fontWeight: '700', color: '#3E5C3A', marginBottom: 16 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: 1, borderColor: '#DDE6C9' },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#CDE3B8', justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#3E5C3A', fontWeight: '700' },
  name: { fontSize: 16, fontWeight: '600', color: '#3E5C3A' },
  meta: { fontSize: 12, color: '#8A9A7C', marginTop: 2 },
  pill: { paddingVertical: 5, paddingHorizontal: 12, borderRadius: 999 },
  pillHot: { backgroundColor: '#CDE3B8' },
  pillEmpty: { backgroundColor: '#EEF2E2' },
  pillText: { fontSize: 12, fontWeight: '600', color: '#3E5C3A' },
});
