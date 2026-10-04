import { router, Stack } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export default function Home() {
  return (
    <View style={s.container}>
      <Stack.Screen options={{ title: 'FieldLens' }} />
      <Text style={s.emoji}>🌾</Text>
      <Text style={s.title}>FieldLens</Text>
      <Text style={s.subtitle}>Rice field plant ID & reporting</Text>

      <Pressable style={s.card} onPress={() => router.push('/user')}>
        <Text style={s.cardTitle}>Farmer / User</Text>
        <Text style={s.cardSub}>Identify plants, keep records, send to your officer</Text>
      </Pressable>

      <Pressable style={[s.card, s.cardAlt]} onPress={() => router.push('/eo')}>
        <Text style={s.cardTitle}>Extension Officer</Text>
        <Text style={s.cardSub}>Review records sent by your farmers</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 28, backgroundColor: '#F3F6E8' },
  emoji: { fontSize: 56, textAlign: 'center' },
  title: { fontSize: 34, fontWeight: '700', color: '#3E5C3A', textAlign: 'center', marginTop: 8 },
  subtitle: { fontSize: 15, color: '#7A8B6F', textAlign: 'center', marginBottom: 36 },
  card: {
    backgroundColor: '#FFFFFF', borderRadius: 18, padding: 22, marginBottom: 16,
    borderWidth: 1, borderColor: '#DDE6C9',
  },
  cardAlt: { backgroundColor: '#EAF3DC' },
  cardTitle: { fontSize: 19, fontWeight: '600', color: '#3E5C3A' },
  cardSub: { fontSize: 13, color: '#7A8B6F', marginTop: 4 },
});
