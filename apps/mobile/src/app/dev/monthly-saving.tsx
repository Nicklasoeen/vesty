import { Redirect } from 'expo-router';

import { MonthlySavingGalleryScreen } from '@/features/invest/MonthlySavingGalleryScreen';

export default function MonthlySavingGalleryRoute() {
  if (!__DEV__) {
    return <Redirect href="/" />;
  }

  return <MonthlySavingGalleryScreen />;
}
