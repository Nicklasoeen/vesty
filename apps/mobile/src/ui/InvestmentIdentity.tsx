import { View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { useTheme } from '@/theme';
import { AppText } from './AppText';

export type InvestmentMarkKey = 'vanguard' | 'ishares';
/** @deprecated Use InvestmentMarkKey — these are issuer marks, not official logos. */
export type InvestmentLogoKey = InvestmentMarkKey;

const MARK_VIEW = 40;
const MARK_RADIUS = 10;

interface InvestmentIdentityProps {
  ticker: string;
  friendlyName?: string | null;
  issuer?: string | null;
  markKey?: InvestmentMarkKey | null;
  /** @deprecated Use markKey */
  logoKey?: InvestmentMarkKey | null;
  fallbackInitials?: string;
  size?: number;
  /** Mark only — parents own the type hierarchy. */
  markOnly?: boolean;
}

/**
 * Vesty-designed issuer marks for curated V1 ETFs.
 * Not official Vanguard or iShares artwork.
 */
function IssuerMark({ markKey, size }: { markKey: InvestmentMarkKey; size: number }) {
  if (markKey === 'vanguard') {
    return (
      <Svg width={size} height={size} viewBox={`0 0 ${MARK_VIEW} ${MARK_VIEW}`} accessible={false}>
        <Rect width={MARK_VIEW} height={MARK_VIEW} rx={MARK_RADIUS} fill="#7C2436" />
        <Path
          d="M20 27.4 L11.4 13.8 H15.4 L20 22.8 L24.6 13.8 H28.6 Z"
          fill="#FFFFFF"
        />
      </Svg>
    );
  }

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${MARK_VIEW} ${MARK_VIEW}`} accessible={false}>
      <Rect width={MARK_VIEW} height={MARK_VIEW} rx={MARK_RADIUS} fill="#152028" />
      <Circle cx="20" cy="12" r="2.7" fill="#FFFFFF" />
      <Path
        d="M18.15 16.2 C18.15 15.5 18.7 15 19.4 15 H20.6 C21.3 15 21.85 15.5 21.85 16.2 V28.1 C21.85 28.8 21.3 29.3 20.6 29.3 H19.4 C18.7 29.3 18.15 28.8 18.15 28.1 Z"
        fill="#FFFFFF"
      />
      <Rect x="12" y="33.2" width="16" height="2.2" rx="1.1" fill="#22C59A" />
    </Svg>
  );
}

function TickerFallback({ initials, size }: { initials: string; size: number }) {
  const { colors } = useTheme();
  const radius = Math.round(size * (MARK_RADIUS / MARK_VIEW));

  return (
    <View
      accessible={false}
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        backgroundColor: colors.mintSoft,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <AppText variant="statLabel" color="accent">
        {initials}
      </AppText>
    </View>
  );
}

export function InvestmentIdentity({
  ticker,
  friendlyName,
  issuer: _issuer,
  markKey = null,
  logoKey = null,
  fallbackInitials,
  size = 36,
  markOnly = false,
}: InvestmentIdentityProps) {
  const resolvedMark = markKey ?? logoKey;
  const initials = fallbackInitials ?? ticker.replace(/[^A-Z0-9]/gi, '').slice(0, 2).toUpperCase() ?? '?';
  const mark = resolvedMark ? (
    <IssuerMark markKey={resolvedMark} size={size} />
  ) : (
    <TickerFallback initials={initials || '?'} size={size} />
  );

  if (markOnly) {
    return mark;
  }

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', minWidth: 0 }}>
      {mark}
      <View style={{ marginLeft: 10, flex: 1, minWidth: 0 }}>
        <AppText variant="bodyStrong" numberOfLines={1}>
          {ticker}
        </AppText>
        {friendlyName ? (
          <AppText variant="supporting" numberOfLines={1} style={{ marginTop: 1 }}>
            {friendlyName}
          </AppText>
        ) : null}
      </View>
    </View>
  );
}
