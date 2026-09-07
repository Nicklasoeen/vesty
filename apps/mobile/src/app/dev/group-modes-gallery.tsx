import { Redirect } from 'expo-router';

import { GroupModeGalleryScreen } from '@/features/group-modes/GroupModeGalleryScreen';

export default function GroupModesGalleryRoute() {
  if (!__DEV__) {
    return <Redirect href="/" />;
  }

  return <GroupModeGalleryScreen />;
}
