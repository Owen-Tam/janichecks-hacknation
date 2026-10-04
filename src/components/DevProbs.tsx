import { StyleSheet, Switch, Text, View } from 'react-native';
import { useDevMode } from '../lib/devMode';
import { LABELS, type LeafStatus } from '../lib/leafModel';

type Props = {
  probs?: number[];
  status?: LeafStatus;
  ms?: number;
};

export function DevModeSwitch() {
  const [on, setOn] = useDevMode();
  return (
    <View style={s.switchRow}>
      <Text style={s.switchLabel}>Dev mode</Text>
      <Switch value={on} onValueChange={setOn} trackColor={{ true: '#7FB069', false: '#DDE6C9' }} />
    </View>
  );
}

export function DevProbs({ probs, status, ms }: Props) {
  const [on] = useDevMode();
  if (!on || !probs?.length) return null;
  const top = probs.indexOf(Math.max(...probs));
  return (
    <View style={s.card}>
      <Text style={s.title}>
        Model{status ? ` · ${status}` : ''}{ms != null ? ` · ${ms} ms` : ''}
      </Text>
      {LABELS.map((label, i) => (
        <View key={label} style={s.row}>
          <Text style={[s.label, i === top && s.top]}>{label}</Text>
          <View style={s.track}>
            <View style={[s.bar, { width: `${Math.max(0, Math.min(1, probs[i] ?? 0)) * 100}%` }]} />
          </View>
          <Text style={s.pct}>{((probs[i] ?? 0) * 100).toFixed(1)}%</Text>
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 8 },
  switchLabel: { fontSize: 13, fontWeight: '600', color: '#8A9A7C' },
  card: { marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#DDE6C9' },
  title: { fontSize: 12, fontWeight: '700', color: '#8A9A7C', marginBottom: 8, textTransform: 'uppercase' },
  row: { flexDirection: 'row', alignItems: 'center', marginVertical: 2 },
  label: { width: 92, fontSize: 12, color: '#5C6B52' },
  top: { fontWeight: '700', color: '#3E5C3A' },
  track: { flex: 1, height: 8, backgroundColor: '#EAF3DC', borderRadius: 4, overflow: 'hidden', marginHorizontal: 8 },
  bar: { height: 8, backgroundColor: '#7FB069' },
  pct: { width: 48, fontSize: 12, color: '#5C6B52', textAlign: 'right' },
});
