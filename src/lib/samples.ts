import type { ImageSourcePropType } from 'react-native';

const SAMPLES: Record<string, ImageSourcePropType> = {
  healthy: require('../../assets/samples/healthy.jpg'),
  leaf_miner: require('../../assets/samples/leaf_miner.jpg'),
  rust: require('../../assets/samples/rust.jpg'),
  phoma: require('../../assets/samples/phoma.jpg'),
  cercospora: require('../../assets/samples/cercospora.jpg'),
};

/** Bundled demo photos are stored as `sample:<key>`. Camera photos stay as file URIs. */
export function recordImage(uri: string | null): ImageSourcePropType | null {
  if (!uri) return null;
  if (uri.startsWith('sample:')) return SAMPLES[uri.slice('sample:'.length)] ?? null;
  return { uri };
}
