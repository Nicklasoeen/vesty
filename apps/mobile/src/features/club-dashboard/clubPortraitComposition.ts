import { splitAvatarStack } from '../../ui/avatarPresentation.ts';

export const CLUB_PORTRAIT_CANVAS_WIDTH = 280;
export const CLUB_PORTRAIT_MAX_VISIBLE = 4;
export const CLUB_PORTRAIT_BOTTOM_PAD = 4;

const SIZE_LG = 72;
const SIZE_MD = 54;
const SIZE_SM = 42;
const SIZE_OVERFLOW = 32;

export interface ClubPortraitMember {
  id: string;
  initials: string;
}

export interface ClubPortraitSlot {
  key: string;
  memberId: string | null;
  initials: string;
  x: number;
  y: number;
  size: number;
  zIndex: number;
  overflow: boolean;
  overflowCount: number;
}

export interface ClubPortraitComposition {
  canvasWidth: number;
  canvasHeight: number;
  slots: ClubPortraitSlot[];
}

interface SlotTemplate {
  x: number;
  y: number;
  size: number;
  zIndex: number;
}

const LAYOUTS: Record<1 | 2 | 3 | 4, readonly SlotTemplate[]> = {
  1: [{ x: 104, y: 4, size: SIZE_LG, zIndex: 1 }],
  2: [
    { x: 80, y: 8, size: SIZE_LG, zIndex: 1 },
    { x: 144, y: 32, size: SIZE_MD, zIndex: 2 },
  ],
  3: [
    { x: 88, y: 14, size: SIZE_LG, zIndex: 2 },
    { x: 154, y: 4, size: SIZE_MD, zIndex: 1 },
    { x: 166, y: 56, size: SIZE_SM, zIndex: 3 },
  ],
  4: [
    { x: 102, y: 12, size: SIZE_LG, zIndex: 2 },
    { x: 164, y: 2, size: SIZE_MD, zIndex: 1 },
    { x: 60, y: 54, size: SIZE_SM, zIndex: 3 },
    { x: 182, y: 56, size: SIZE_SM, zIndex: 4 },
  ],
};

const OVERFLOW_SLOT: SlotTemplate = { x: 208, y: 18, size: SIZE_OVERFLOW, zIndex: 5 };

function portraitInitials(value: string): string {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : '?';
}

function canvasHeightFor(slots: readonly ClubPortraitSlot[]): number {
  if (slots.length === 0) {
    return 0;
  }

  const bottom = Math.max(...slots.map((slot) => slot.y + slot.size));
  return bottom + CLUB_PORTRAIT_BOTTOM_PAD;
}

/**
 * Deterministic floating portrait layout. Same roster always produces the
 * same positions — never randomized per render.
 */
export function composeClubPortraits(
  members: readonly ClubPortraitMember[],
): ClubPortraitComposition {
  const { visible, overflowCount } = splitAvatarStack(members, CLUB_PORTRAIT_MAX_VISIBLE);
  const visibleCount = visible.length;
  const templates =
    visibleCount === 1 || visibleCount === 2 || visibleCount === 3 || visibleCount === 4
      ? LAYOUTS[visibleCount]
      : [];

  const slots: ClubPortraitSlot[] = visible.map((member, index) => {
    const template = templates[index];
    if (!template) {
      throw new Error('Missing portrait template');
    }

    return {
      key: member.id,
      memberId: member.id,
      initials: portraitInitials(member.initials),
      x: template.x,
      y: template.y,
      size: template.size,
      zIndex: template.zIndex,
      overflow: false,
      overflowCount: 0,
    };
  });

  if (overflowCount > 0) {
    slots.push({
      key: 'overflow',
      memberId: null,
      initials: `+${overflowCount}`,
      x: OVERFLOW_SLOT.x,
      y: OVERFLOW_SLOT.y,
      size: OVERFLOW_SLOT.size,
      zIndex: OVERFLOW_SLOT.zIndex,
      overflow: true,
      overflowCount,
    });
  }

  return {
    canvasWidth: CLUB_PORTRAIT_CANVAS_WIDTH,
    canvasHeight: canvasHeightFor(slots),
    slots,
  };
}
