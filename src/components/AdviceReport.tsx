import { StyleSheet, Text, View } from 'react-native';
import { adviceFor, displayTitle } from '../lib/advice';
import type { LeafStatus } from '../lib/leafModel';

type Props = {
  label: string;
  status: LeafStatus;
  date?: string;
};

export function AdviceReport({ label, status, date }: Props) {
  const report = adviceFor(label, status, date);
  return (
    <View>
      <Text style={s.title}>{report.title}</Text>
      {report.sections.map((section) => (
        <View key={section.heading} style={s.block}>
          <Text style={s.heading}>{section.heading}</Text>
          <Text style={s.body}>{section.body}</Text>
        </View>
      ))}
    </View>
  );
}

export function DiagnosisLine({ label, status }: { label: string; status: LeafStatus }) {
  return <Text style={s.line}>{displayTitle(label, status)}</Text>;
}

const s = StyleSheet.create({
  title: { fontSize: 22, fontWeight: '700', color: '#3E5C3A', marginBottom: 8 },
  block: { marginTop: 10 },
  heading: { fontSize: 14, fontWeight: '700', color: '#3E5C3A', marginBottom: 4 },
  body: { fontSize: 14, color: '#5C6B52', lineHeight: 20 },
  line: { fontSize: 15, fontWeight: '600', color: '#3E5C3A', marginTop: 6 },
});
