import { Stack, router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Bg from '../../components/Bg';
import { storedText, useI18n } from '../../i18n';
import { FieldUser, getUsers } from '../../lib/store';
import { fonts } from '../../lib/theme';

export default function EoHome() {
  const [users, setUsers] = useState<FieldUser[]>([]);
  const { t } = useI18n();
  useFocusEffect(useCallback(() => { getUsers().then(setUsers); }, []));

  return (
    <Bg>
      <Stack.Screen options={{ title: t('officer.title') }} />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20 }}>
        <Text style={s.heading}>{t('officer.heading')}</Text>
        {users.map((u) => {
          const sent = u.records.filter((r) => r.status === 'sent').length;
          return (
            <Pressable key={u.id} style={s.card} onPress={() => router.push({ pathname: '/eo/[userId]', params: { userId: u.id } })}>
              <View style={s.avatar}><Text style={s.avatarText}>{u.name.split(' ').map((n) => n[0]).join('')}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={s.name}>{u.name}</Text>
                <Text style={s.meta}>{u.village} · {storedText(u.crop, t)}</Text>
              </View>
              <View style={[s.pill, sent > 0 ? s.pillHot : s.pillEmpty]}>
                <Text style={[s.pillText, sent === 0 && { color: '#3E5C3A' }]}>{t('officer.sentCount', { count: sent })}</Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </Bg>
  );
}

const s = StyleSheet.create({
  heading: { fontSize: 22, fontFamily: fonts.headingBold, color: '#3E5C3A', marginBottom: 16 },
  card: { backgroundColor: '#F6F0DF', borderRadius: 16, padding: 16, marginBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: 1, borderColor: '#DDE6C9' },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#CDE3B8', justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#3E5C3A', fontFamily: fonts.bodySemi },
  name: { fontSize: 16, fontFamily: fonts.heading, color: '#3E5C3A' },
  meta: { fontSize: 12, color: '#8A9A7C', marginTop: 2 },
  pill: { paddingVertical: 5, paddingHorizontal: 12, borderRadius: 999 },
  pillHot: { backgroundColor: '#ECBA9A' },
  pillEmpty: { backgroundColor: '#EEF2E2' },
  pillText: { fontSize: 12, fontFamily: fonts.bodySemi, color: '#FFFFFF' },
});
