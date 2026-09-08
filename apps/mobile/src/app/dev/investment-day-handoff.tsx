import { Redirect } from 'expo-router';

import { InvestmentDayHandoffGalleryScreen } from '@/features/invest/InvestmentDayHandoffGalleryScreen';

export default function InvestmentDayHandoffGalleryRoute() {
  if (!__DEV__) {
    return <Redirect href="/" />;
  }

  return <InvestmentDayHandoffGalleryScreen />;
}
