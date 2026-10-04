import { CameraType, CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { router, Stack } from 'expo-router';
import { useRef, useState } from 'react';
import {
  Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { CURRENT_USER_ID, FieldUser, getUsers, Plant, saveUsers } from '../../lib/store';

type Step = 'camera' | 'preview' | 'classify' | 'name' | 'existing';

export default function CameraScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [facing] = useState<CameraType>('back');
  const camRef = useRef<CameraView | null>(null);
  const [step, setStep] = useState<Step>('camera');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const [user, setUser] = useState<FieldUser | null>(null);

  async function ensureUser() {
    if (user) return user;
    const all = await getUsers();
    const u = all.find((x) => x.id === CURRENT_USER_ID) ?? null;
    setUser(u);
    return u;
  }

  async function pickFromLibrary() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission required', 'Please allow photo library access.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
      setStep('preview');
    }
  }

  async function takePhoto() {
    const pic = await camRef.current?.takePictureAsync({ quality: 0.7 });
    if (pic) {
      setPhotoUri(pic.uri);
      setStep('preview');
    }
  }

  async function saveNewPlant() {
    if (!name.trim() || !photoUri) return;
    const all = await getUsers();
    const u = all.find((x) => x.id === CURRENT_USER_ID);
    if (!u) return;
    const plantId = `p${Date.now()}`;
    const plant: Plant = { id: plantId, name: name.trim(), species: 'To be confirmed', identifiedAt: new Date().toISOString().slice(0, 10) };
    const rec = { id: `r${Date.now()}`, plantId, imageUri: photoUri, date: new Date().toISOString().slice(0, 10), status: 'pending' as const, note: note.trim() || 'Logged from new photo.' };
    u.plants.push(plant);
    u.records.push(rec);
    await saveUsers(all);
    done();
  }

  async function attachToExisting(plantId: string) {
    if (!photoUri) return;
    const all = await getUsers();
    const u = all.find((x) => x.id === CURRENT_USER_ID);
    if (!u) return;
    u.records.push({ id: `r${Date.now()}`, plantId, imageUri: photoUri, date: new Date().toISOString().slice(0, 10), status: 'pending', note: note.trim() || 'Added to existing record.' });
    await saveUsers(all);
    done();
  }

  function done() {
    Alert.alert('Saved ✓', 'Record added to your Previous Records.', [
      { text: 'OK', onPress: () => router.replace('/user/records') },
    ]);
  }

  if (!permission) return <View style={s.center} />;
  if (!permission.granted) {
    return (
      <View style={s.center}>
        <Text style={s.muted}>We need your permission to use the camera.</Text>
        <Pressable style={s.btn} onPress={requestPermission}><Text style={s.btnText}>Grant permission</Text></Pressable>
        <Pressable style={[s.btn, s.btnGhost, { marginTop: 10 }]} onPress={pickFromLibrary}><Text style={s.btnGhostText}>Choose from Photo Library</Text></Pressable>
      </View>
    );
  }

  if (step === 'camera') {
    return (
      <View style={{ flex: 1 }}>
        <Stack.Screen options={{ title: 'New Photo' }} />
        <CameraView ref={camRef} style={{ flex: 1 }} facing={facing} />
        <View style={s.shutterBar}>
          <Pressable style={s.shutter} onPress={takePhoto} />
          <Pressable style={s.libraryBtn} onPress={pickFromLibrary}><Text style={s.libraryText}>🖼 Library</Text></Pressable>
        </View>
      </View>
    );
  }

  if (step === 'preview' && photoUri) {
    return (
      <View style={s.container}>
        <Image source={{ uri: photoUri }} style={s.preview} />
        <View style={s.row}>
          <Pressable style={[s.btn, s.btnGhost]} onPress={() => setStep('camera')}><Text style={s.btnGhostText}>Retake</Text></Pressable>
          <Pressable style={s.btn} onPress={async () => { await ensureUser(); setStep('classify'); }}><Text style={s.btnText}>Use Photo</Text></Pressable>
        </View>
      </View>
    );
  }

  if (step === 'classify') {
    return (
      <View style={[s.container, { justifyContent: 'center' }]}>
        <Text style={s.heading}>Is this a new plant or an already identified one?</Text>
        <Pressable style={s.card} onPress={() => setStep('name')}>
          <Text style={s.cardTitle}>🌱 New plant</Text>
          <Text style={s.cardSub}>Give it a name and start a new record</Text>
        </Pressable>
        <Pressable style={[s.card, s.cardAlt]} onPress={async () => { await ensureUser(); setStep('existing'); }}>
          <Text style={s.cardTitle}>📁 Already identified</Text>
          <Text style={s.cardSub}>Add this photo to an existing plant record</Text>
        </Pressable>
      </View>
    );
  }

  if (step === 'name') {
    return (
      <ScrollView style={s.container} contentContainerStyle={{ padding: 24 }}>
        <Text style={s.heading}>Name the new plant</Text>
        <TextInput style={s.input} placeholder="Plant name (e.g. Rice Plant C)" placeholderTextColor="#A9B79B" value={name} onChangeText={setName} />
        <TextInput style={s.input} placeholder="Optional note" placeholderTextColor="#A9B79B" value={note} onChangeText={setNote} />
        <Pressable style={s.btn} onPress={saveNewPlant}><Text style={s.btnText}>Save Record</Text></Pressable>
        <Pressable style={[s.btn, s.btnGhost]} onPress={() => setStep('classify')}><Text style={s.btnGhostText}>Back</Text></Pressable>
      </ScrollView>
    );
  }

  // existing
  return (
    <ScrollView style={s.container} contentContainerStyle={{ padding: 24 }}>
      <Text style={s.heading}>Choose existing plant</Text>
      {user?.plants.length === 0 && <Text style={s.muted}>No plants yet — create a new one instead.</Text>}
      {user?.plants.map((p) => (
        <Pressable key={p.id} style={s.card} onPress={() => attachToExisting(p.id)}>
          <Text style={s.cardTitle}>{p.name}</Text>
          <Text style={s.cardSub}>{p.species} · since {p.identifiedAt}</Text>
        </Pressable>
      ))}
      <Pressable style={[s.btn, s.btnGhost]} onPress={() => setStep('classify')}><Text style={s.btnGhostText}>Back</Text></Pressable>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F6E8' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F3F6E8', padding: 24 },
  muted: { color: '#8A9A7C', fontSize: 14, marginBottom: 12, textAlign: 'center' },
  heading: { fontSize: 20, fontWeight: '700', color: '#3E5C3A', marginBottom: 18, textAlign: 'center' },
  preview: { flex: 1, margin: 16, borderRadius: 16 },
  row: { flexDirection: 'row', gap: 14, padding: 16 },
  shutterBar: { position: 'absolute', bottom: 40, width: '100%', alignItems: 'center' },
  shutter: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#FFFFFF', borderWidth: 5, borderColor: '#7FB069' },
  libraryBtn: { position: 'absolute', right: 32, top: 18, backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: 12, paddingVertical: 8, paddingHorizontal: 12 },
  libraryText: { color: '#3E5C3A', fontWeight: '600', fontSize: 13 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 18, marginBottom: 14, borderWidth: 1, borderColor: '#DDE6C9' },
  cardAlt: { backgroundColor: '#EAF3DC' },
  cardTitle: { fontSize: 17, fontWeight: '600', color: '#3E5C3A' },
  cardSub: { fontSize: 13, color: '#7A8B6F', marginTop: 4 },
  input: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DDE6C9', borderRadius: 12, padding: 14, marginBottom: 14, color: '#3E5C3A' },
  btn: { backgroundColor: '#7FB069', paddingVertical: 14, paddingHorizontal: 22, borderRadius: 14, alignItems: 'center', marginTop: 6, flex: 1 },
  btnGhost: { backgroundColor: '#EAF3DC' },
  btnText: { color: '#FFFFFF', fontWeight: '600', fontSize: 15 },
  btnGhostText: { color: '#3E5C3A', fontWeight: '600', fontSize: 15 },
});
