import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useI18n, type Lang } from '../i18n';

const OPTIONS: { id: Lang; label: string }[] = [
  { id: 'sw', label: 'Kiswahili' },
  { id: 'en', label: 'English' },
];

export function LanguageSwitch() {
  const { lang, setLang } = useI18n();
  return (
    <View style={s.row}>
      {OPTIONS.map((option) => {
        const on = lang === option.id;
        return (
          <Pressable key={option.id} style={[s.chip, on && s.chipOn]} onPress={() => setLang(option.id)}>
            <Text style={[s.text, on && s.textOn]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 8 },
  chip: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 999, backgroundColor: '#F6F0DF', borderWidth: 1, borderColor: '#DDE6C9' },
  chipOn: { backgroundColor: '#7FB069', borderColor: '#7FB069' },
  text: { color: '#3E5C3A', fontWeight: '600', fontSize: 13 },
  textOn: { color: '#FFFFFF' },
});
