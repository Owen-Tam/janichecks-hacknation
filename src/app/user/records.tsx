import { Stack, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
  Alert,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Pressable,
} from "react-native";
import { AdviceReport, DiagnosisLine } from "../../components/AdviceReport";
import Bg from "../../components/Bg";
import { storedText, useI18n } from "../../i18n";
import { pairedDisease } from "../../lib/leafModel";
import { recordImage } from "../../lib/samples";
import { fonts } from "../../lib/theme";

import {
  CURRENT_USER_ID,
  FieldUser,
  getUsers,
  plantNameFor,
  saveUsers,
} from "../../lib/store";

export default function Records() {
  const { t } = useI18n();
  const [user, setUser] = useState<FieldUser | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      getUsers().then((all) =>
        setUser(all.find((u) => u.id === CURRENT_USER_ID) ?? null),
      );
    }, []),
  );

  async function setStatus(recordId: string, status: "confirmed" | "sent") {
    const all = await getUsers();
    const next = all.map((u) =>
      u.id !== CURRENT_USER_ID
        ? u
        : {
            ...u,
            records: u.records.map((r) =>
              r.id === recordId ? { ...r, status } : r,
            ),
          },
    );
    await saveUsers(next);
    setUser(next.find((u) => u.id === CURRENT_USER_ID) ?? null);
    if (status === "sent") {
      const title = t("records.sentTitle");
      const body = t("records.sentBody");
      if (Platform.OS === "web") window.alert(`${title}\n\n${body}`);
      else Alert.alert(title, body);
    }
  }

  if (!user)
    return (
      <Bg>
        <View style={s.center}>
          <Text style={s.muted}>{t("common.loading")}</Text>
        </View>
      </Bg>
    );

  const sorted = [...user.records].sort((a, b) => (a.date < b.date ? 1 : -1));
  const open = sorted.find((r) => r.id === openId) ?? null;

  if (open) {
    return (
      <ScrollView
        style={s.container}
        contentContainerStyle={{ padding: 20, paddingBottom: 60 }}
      >
        <Stack.Screen options={{ title: t("records.record") }} />
        {recordImage(open.imageUri) ? (
          <Image source={recordImage(open.imageUri)!} style={s.image} />
        ) : (
          <View style={[s.image, s.placeholder]}>
            <Text style={{ fontSize: 34 }}>🌿</Text>
          </View>
        )}
        <Text style={s.plantName}>{storedText(plantNameFor(user, open.plantId), t)}</Text>
        <Text style={s.meta}>{open.date}</Text>
        {!!open.note && <Text style={s.note}>{storedText(open.note, t)}</Text>}
        <View style={s.reportCard}>
          {open.diagnosis ? (
            <>
              <AdviceReport
                label={open.diagnosis.label}
                status={open.diagnosis.status}
                also={pairedDisease(open.diagnosis.status, open.diagnosis.also, open.diagnosis.probs)}
                date={open.date}
              />
            </>
          ) : (
            <Text style={s.muted}>{t("records.noDiagnosis")}</Text>
          )}
        </View>
        <StatusRow status={open.status} onConfirm={() => setStatus(open.id, "confirmed")} onSend={() => setStatus(open.id, "sent")} />
        <Pressable
          style={[s.btn, s.btnGhost, { marginTop: 12, alignItems: "center" }]}
          onPress={() => setOpenId(null)}
        >
          <Text style={s.btnGhostText}>{t("records.back")}</Text>
        </Pressable>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={s.container}
      contentContainerStyle={{ padding: 20, paddingBottom: 60 }}
    >
      <Stack.Screen options={{ title: t("records.title") }} />
      <Text style={s.heading}>{t("records.heading")}</Text>
      {sorted.length === 0 && <Text style={s.muted}>{t("records.empty")}</Text>}
      {sorted.map((r) => (
        <View key={r.id} style={s.card}>
          <Pressable onPress={() => setOpenId(r.id)}>
            {recordImage(r.imageUri) ? (
              <Image source={recordImage(r.imageUri)!} style={s.image} />
            ) : (
              <View style={[s.image, s.placeholder]}>
                <Text style={{ fontSize: 34 }}>🌿</Text>
              </View>
            )}
            <Text style={s.plantName}>{storedText(plantNameFor(user, r.plantId), t)}</Text>
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
          <StatusRow status={r.status} onConfirm={() => setStatus(r.id, "confirmed")} onSend={() => setStatus(r.id, "sent")} />
        </View>
      ))}
    </ScrollView>
  );
}

function StatusRow({
  status,
  onConfirm,
  onSend,
}: {
  status: "pending" | "confirmed" | "sent";
  onConfirm: () => void;
  onSend: () => void;
}) {
  const { t } = useI18n();
  return (
    <View style={s.row}>
      {status === "pending" && (
        <Pressable style={s.btn} onPress={onConfirm}>
          <Text style={s.btnText}>{t("records.confirm")}</Text>
        </Pressable>
      )}
      {status === "confirmed" && (
        <>
          <View style={[s.badge, s.badgeConfirmed]}><Text style={s.badgeText}>✓ {t("records.confirmed")}</Text></View>
          <Pressable style={s.btn} onPress={onSend}>
            <Text style={s.btnText}>{t("records.send")}</Text>
          </Pressable>
        </>
      )}
      {status === "sent" && (
        <View style={[s.badge, s.badgeSent, { flexDirection: "row", alignItems: "center", gap: 6 }]}>
          <Image source={require("../../../assets/letter.png")} style={{ width: 28, height: 28 }} resizeMode="contain" />
          <Text style={[s.badgeText, { color: "#FFFFFF" }]}>{t("records.sent")}</Text>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  reportCard: { backgroundColor: "#F6F0DF", borderRadius: 16, padding: 16, marginTop: 14, borderWidth: 1, borderColor: "#DDE6C9" },
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
  btnGhost: { backgroundColor: "#EAF3DC" },
  btnText: { color: '#3E5C3A', fontFamily: fonts.bodySemi, fontSize: 14 },
  btnGhostText: { color: "#3E5C3A", fontFamily: fonts.bodySemi, fontSize: 14 },
  badge: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999 },
  badgeConfirmed: { backgroundColor: '#EAF3DC' },
  badgeSent: { backgroundColor: '#ECBA9A' },
  badgeText: { color: '#3E5C3A', fontFamily: fonts.bodySemi, fontSize: 13 },
});
