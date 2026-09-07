import { Redirect } from 'expo-router';

import { InvestmentDayReportGalleryScreen } from '@/features/invest/InvestmentDayReportGalleryScreen';

export default function InvestmentDayReportingGalleryRoute() {
  if (!__DEV__) {
    return <Redirect href="/" />;
  }

  return <InvestmentDayReportGalleryScreen />;
}
