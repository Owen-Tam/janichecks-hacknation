import { View } from 'react-native';
import { ReactNode } from 'react';

export default function Bg({ children }: { children: ReactNode }) {
  return <View style={{ flex: 1, backgroundColor: '#F3F6E8' }}>{children}</View>;
}
