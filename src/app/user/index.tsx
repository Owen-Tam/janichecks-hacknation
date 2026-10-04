import { router, Stack } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export default function UserHome() {
  return (
    <View style={s.container}>
      <Stack.Screen options={{ title: 'User' }} />
      <Text style={s.heading}>What would you like to do?</Text>

      <Pressable style={s.card} onPress={() => router.push('/user/camera')}>
        <Text style={s.icon}>📷</Text>
        <Text style={s.cardTitle}>Take New Photo</Text>
        <Text style={s.cardSub}>Identify a plant and log it</Text>
      </Pressable>

      <Pressable style={[s.card, s.cardAlt]} onPress={() => router.push('/user/records')}>
        <Text style={s.icon}>🗂️</Text>
        <Text style={s.cardTitle}>Previous Records</Text>
        <Text style={s.cardSub}>Review and confirm your plants</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: '#F3F6E8', justifyContent: 'center' },
  heading: { fontSize: 22, fontWeight: '700', color: '#3E5C3A', marginBottom: 24, textAlign: 'center' },
  card: {
    backgroundColor: '#FFFFFF', borderRadius: 18, padding: 26, marginBottom: 16,
    alignItems: 'center', borderWidth: 1, borderColor: '#DDE6C9',
  },
  cardAlt: { backgroundColor: '#EAF3DC' },
  icon: { fontSize: 40, marginBottom: 10 },
  cardTitle: { fontSize: 19, fontWeight: '600', color: '#3E5C3A' },
  cardSub: { fontSize: 13, color: '#7A8B6F', marginTop: 4 },
});
