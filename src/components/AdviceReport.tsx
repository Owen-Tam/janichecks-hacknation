import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { Asset } from 'expo-asset';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useI18n } from '../i18n';
import { adviceFor, displayTitle } from '../lib/advice';
import type { LeafStatus } from '../lib/leafModel';
import { clipFor } from '../lib/swahiliAudio';

type Props = {
  label: string;
  status: LeafStatus;
  also?: string;
  date?: string;
};

export function AdviceReport({ label, status, also, date }: Props) {
  const { t } = useI18n();
  if (status === 'possibly_multiple' && also) {
    return (
      <View>
        <Text style={s.multi}>{t('advice.multiple')}</Text>
        <DiseaseReport label={label} status="confident" date={date} />
        <View style={s.divider} />
        <DiseaseReport label={also} status="confident" date={date} />
      </View>
    );
  }
  return <DiseaseReport label={label} status={status} date={date} />;
}

function DiseaseReport({ label, status, date }: { label: string; status: LeafStatus; date?: string }) {
  const { t } = useI18n();
  const report = adviceFor(label, status, t, date);
  const player = useAudioPlayer(null);
  const playback = useAudioPlayerStatus(player);
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
  }, []);

  async function toggle(key: string) {
    const clip = clipFor(label, status, key);
    if (clip == null) return;
    if (active === key && playback.playing) {
      player.pause();
      setActive(null);
      return;
    }
    try {
      const asset = Asset.fromModule(clip);
      await asset.downloadAsync();
      const uri = asset.localUri ?? asset.uri;
      if (!uri) return;
      await setAudioModeAsync({ playsInSilentMode: true });
      player.replace({ uri });
      player.play();
      setActive(key);
    } catch {
      setActive(null);
    }
  }

  return (
    <View>
      <View style={s.titleRow}>
        <Text style={s.title}>{report.title}</Text>
        {report.audio && <ListenButton playing={active === report.audio && playback.playing} onPress={() => toggle(report.audio!)} />}
      </View>
      {report.sections.map((section) => (
        <View key={section.heading} style={s.block}>
          <View style={s.headingRow}>
            <Text style={s.heading}>{section.heading}</Text>
            {section.audio && section.audio !== report.audio && (
              <ListenButton playing={active === section.audio && playback.playing} onPress={() => toggle(section.audio!)} />
            )}
          </View>
          <Text style={s.body}>{section.body}</Text>
        </View>
      ))}
    </View>
  );
}

function ListenButton({ playing, onPress }: { playing: boolean; onPress: () => void }) {
  const { t } = useI18n();
  return (
    <Pressable style={[s.listen, playing && s.listenOn]} onPress={onPress}>
      <Text style={[s.listenText, playing && s.listenTextOn]}>{playing ? t('common.stop') : t('common.listen')}</Text>
    </Pressable>
  );
}

export function DiagnosisLine({ label, status, also }: { label: string; status: LeafStatus; also?: string }) {
  const { t } = useI18n();
  return <Text style={s.line}>{displayTitle(label, status, t, also)}</Text>;
}

const s = StyleSheet.create({
  multi: { fontSize: 13, color: '#8A6A3A', marginBottom: 12, lineHeight: 18 },
  divider: { height: 1, backgroundColor: '#DDE6C9', marginVertical: 16 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  title: { flex: 1, fontSize: 22, fontWeight: '700', color: '#3E5C3A' },
  block: { marginTop: 12 },
  headingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 4 },
  heading: { flex: 1, fontSize: 14, fontWeight: '700', color: '#3E5C3A' },
  body: { fontSize: 14, color: '#5C6B52', lineHeight: 20 },
  line: { fontSize: 15, fontWeight: '600', color: '#3E5C3A', marginTop: 6 },
  listen: { backgroundColor: '#EAF3DC', borderRadius: 999, paddingVertical: 5, paddingHorizontal: 12 },
  listenOn: { backgroundColor: '#7FB069' },
  listenText: { color: '#3E5C3A', fontWeight: '600', fontSize: 12 },
  listenTextOn: { color: '#FFFFFF' },
});
