import type { ImageSourcePropType } from 'react-native';

export interface CurrentProfile {
  id: string;
  displayName: string | null;
  avatarPath: string | null;
}

export interface ProfilePresentation {
  displayName: string | null;
  initials: string;
  imageSource?: ImageSourcePropType;
}
