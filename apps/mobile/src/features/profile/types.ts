import type { ImageSourcePropType } from 'react-native';

import type { PreferredBroker } from './brokers';

export interface CurrentProfile {
  id: string;
  displayName: string | null;
  avatarPath: string | null;
  preferredBroker: PreferredBroker | null;
}

export interface ProfilePresentation {
  displayName: string | null;
  initials: string;
  imageSource?: ImageSourcePropType;
}
