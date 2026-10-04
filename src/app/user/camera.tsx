import { CameraType, CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { router, Stack } from 'expo-router';
import { useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { AdviceReport } from '../../components/AdviceReport';
import { classifyLeaf, LeafPrediction } from '../../lib/leafModel';
import { fonts } from '../../lib/theme';
import Bg from '../../components/Bg';

import { CURRENT_USER_ID, FieldUser, getUsers, Plant, saveUsers } from '../../lib/store';

type Step = 'camera' | 'preview' | 'classify' | 'name' | 'existing';

const newId = (prefix: string) => `${prefix}${Date.now()}`;
const today = () => new Date().toISOString().slice(0, 10);

export default function CameraScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [facing] = useState<CameraType>('back');
  const camRef = useRef<CameraView | null>(null);
  const [step, setStep] = useState<Step>('camera');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const [user, setUser] = useState<FieldUser | null>(null);
  const [prediction, setPrediction] = useState<LeafPrediction | null>(null);
  const [predictError, setPredictError] = useState<string | null>(null);

  const latestUri = useRef<string | null>(null);

  function snapshot(): Diagnosis | undefined {
    if (!prediction) return undefined;
    return { label: prediction.label, status: prediction.status };
  }

  function showPreview(uri: string) {
    setPhotoUri(uri);
    setStep('preview');
    setPrediction(null);
    setPredictError(null);
    latestUri.current = uri;
    classifyLeaf(uri)
      .then((p) => { if (latestUri.current === uri) setPrediction(p); })
      .catch((e) => { if (latestUri.current === uri) setPredictError(String(e?.message ?? e)); });
  }

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
      Alert.alert('Ruhusa Inahitajika', 'Tafadhali ruhusu ufikiaji wa maktaba ya picha.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (!result.canceled && result.assets[0]) showPreview(result.assets[0].uri);
  }

  async function takePhoto() {
    const pic = await camRef.current?.takePictureAsync({ quality: 0.7 });
    if (pic) showPreview(pic.uri);
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
    Alert.alert('Imehifadhiwa ✓', 'Rekodi imeongezwa kwenye Rekodi za Awali.', [
      { text: 'Sawa', onPress: () => router.replace('/user/records') },
    ]);
  }

  if (!permission) return <Bg><View style={s.center} /></Bg>;
  if (!permission.granted) {
    return (
      <Bg>
        <View style={s.center}>
          <Text style={s.muted}>Tunahitaji ruhusa ya kutumia kamera.</Text>
          <Pressable style={s.btnWide} onPress={requestPermission}><Text style={s.btnText}>Toa Ruhusa</Text></Pressable>
          <Pressable style={[s.btnWide, s.btnGhost, { marginTop: 10 }]} onPress={pickFromLibrary}><Text style={s.btnGhostText}>Chagua kutoka Maktaba ya Picha</Text></Pressable>
        </View>
      </Bg>
    );
  }

  if (step === 'camera') {
    return (
      <View style={{ flex: 1 }}>
        <Stack.Screen options={{ title: 'Picha Mpya' }} />
        <CameraView ref={camRef} style={{ flex: 1 }} facing={facing} />
        <View style={s.shutterBar}>
          <Pressable style={s.shutter} onPress={takePhoto} />
          <Pressable style={s.libraryBtn} onPress={pickFromLibrary}><Text style={s.libraryText}>🖼 Maktaba</Text></Pressable>
        </View>
      </View>
    );
  }

  if (step === 'preview' && photoUri) {
    const ready = !!prediction || !!predictError;
    return (
      <View style={s.container}>
        <Image source={{ uri: photoUri }} style={s.preview} />
        <View style={s.row}>
          <Pressable style={[s.btn, s.btnGhost]} onPress={() => setStep('camera')}><Text style={s.btnGhostText}>Retake</Text></Pressable>
          <Pressable style={s.btn} onPress={async () => { await ensureUser(); setStep('classify'); }}><Text style={s.btnText}>Use Photo</Text></Pressable>
        </View>
      </Bg>
    );
  }

  if (step === 'classify') {
    return (
      <Bg>
        <Stack.Screen options={{ title: 'Aina ya Mmea' }} />
        <View style={[s.center, { padding: 24 }]}>
          <Text style={s.heading}>Je, huu ni mmea mpya au ambao tayari umekwishajulikana?</Text>
          <Pressable style={s.card} onPress={() => setStep('name')}>
            <Text style={s.cardTitle}>🌱 Mmea Mpya</Text>
            <Text style={s.cardSub}>Ipe jina na uanze rekodi mpya</Text>
          </Pressable>
          <Pressable style={[s.card, s.cardAlt]} onPress={async () => { await ensureUser(); setStep('existing'); }}>
            <Text style={s.cardTitle}>📁 Umekwishajulikana</Text>
            <Text style={s.cardSub}>Ongeza picha hii kwenye rekodi ya mmea uliopo</Text>
          </Pressable>
        </View>
      </Bg>
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
    <Bg>
      <Stack.Screen options={{ title: 'Chagua Mmea' }} />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 24 }}>
        <Text style={s.heading}>Chagua mmea uliopo</Text>
        {user?.plants.length === 0 && <Text style={s.muted}>Hakuna mimea bado — tengeneza mpya badala yake.</Text>}
        {user?.plants.map((p) => (
          <Pressable key={p.id} style={s.card} onPress={() => attachToExisting(p.id)}>
            <Text style={s.cardTitle}>{p.name}</Text>
            <Text style={s.cardSub}>{p.species} · tangu {p.identifiedAt}</Text>
          </Pressable>
        ))}
        <Pressable style={[s.btnWide, s.btnGhost, { marginTop: 10 }]} onPress={() => setStep('classify')}><Text style={s.btnGhostText}>Rudi</Text></Pressable>
      </ScrollView>
    </Bg>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  muted: { color: '#8A9A7C', fontSize: 14, marginBottom: 12, textAlign: 'center' },
  heading: { fontSize: 20, fontWeight: '700', color: '#3E5C3A', marginBottom: 18, textAlign: 'center' },
  preview: { flex: 1, margin: 16, borderRadius: 16 },
  row: { flexDirection: 'row', gap: 14, padding: 16 },
  shutterBar: { position: 'absolute', bottom: 40, width: '100%', alignItems: 'center' },
  shutter: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#FFFFFF', borderWidth: 5, borderColor: '#7FB069' },
  libraryBtn: { position: 'absolute', right: 32, top: 18, backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: 12, paddingVertical: 8, paddingHorizontal: 12 },
  libraryText: { color: '#3E5C3A', fontFamily: fonts.bodySemi, fontSize: 13 },
  card: { backgroundColor: '#F6F0DF', borderRadius: 16, padding: 18, marginBottom: 14, borderWidth: 1, borderColor: '#DDE6C9' },
  cardAlt: { backgroundColor: '#F6F0DF' },
  cardTitle: { fontSize: 17, fontFamily: fonts.heading, color: '#3E5C3A' },
  cardSub: { fontSize: 13, color: '#7A8B6F', marginTop: 4 },
  input: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DDE6C9', borderRadius: 12, padding: 14, marginBottom: 14, color: '#3E5C3A' },
  btn: { backgroundColor: '#7FB069', paddingVertical: 14, paddingHorizontal: 22, borderRadius: 14, alignItems: 'center', marginTop: 6, flex: 1 },
  btnGhost: { backgroundColor: '#EAF3DC' },
  btnText: { color: '#FFFFFF', fontWeight: '600', fontSize: 15 },
  btnGhostText: { color: '#3E5C3A', fontWeight: '600', fontSize: 15 },
});
