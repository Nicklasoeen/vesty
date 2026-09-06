import { View } from 'react-native';

import type { AvatarPerson } from '@/ui';
import { Avatar } from '@/ui';

import { composeClubPortraits } from './clubPortraitComposition';

interface ClubMemberPortraitsProps {
  members: readonly AvatarPerson[];
}

function avatarSizeFor(diameter: number): 'sm' | 'md' | 'xl' {
  if (diameter >= 64) {
    return 'xl';
  }
  if (diameter >= 50) {
    return 'md';
  }
  return 'sm';
}

export function ClubMemberPortraits({ members }: ClubMemberPortraitsProps) {
  const composition = composeClubPortraits(members);
  const peopleById = new Map(members.map((person) => [person.id, person]));

  return (
    <View
      accessible
      accessibilityLabel="Club members"
      style={{
        alignItems: 'center',
        height: composition.canvasHeight,
      }}
    >
      <View
        style={{
          width: composition.canvasWidth,
          height: composition.canvasHeight,
        }}
      >
        {composition.slots.map((slot) => {
          const person = slot.memberId ? peopleById.get(slot.memberId) : undefined;

          return (
            <Avatar
              key={slot.key}
              initials={slot.initials}
              imageSource={person?.imageSource}
              size={avatarSizeFor(slot.size)}
              overlap
              overflow={slot.overflow}
              accessibilityLabel={
                slot.overflow
                  ? `${slot.overflowCount} additional ${slot.overflowCount === 1 ? 'member' : 'members'}`
                  : undefined
              }
              style={{
                position: 'absolute',
                left: slot.x,
                top: slot.y,
                width: slot.size,
                height: slot.size,
                borderRadius: slot.size / 2,
                zIndex: slot.zIndex,
              }}
            />
          );
        })}
      </View>
    </View>
  );
}
