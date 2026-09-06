import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { resolveAvatarContent } from '../../ui/avatarPresentation.ts';

import {
  CLUB_PORTRAIT_BOTTOM_PAD,
  CLUB_PORTRAIT_CANVAS_WIDTH,
  CLUB_PORTRAIT_MAX_VISIBLE,
  composeClubPortraits,
} from './clubPortraitComposition.ts';

function members(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    id: `member-${index + 1}`,
    initials: `M${index + 1}`,
  }));
}

function overlap(left: { x: number; y: number; size: number }, right: { x: number; y: number; size: number }) {
  const dx = left.x + left.size / 2 - (right.x + right.size / 2);
  const dy = left.y + left.size / 2 - (right.y + right.size / 2);
  return Math.hypot(dx, dy) < (left.size + right.size) / 2;
}

describe('composeClubPortraits', () => {
  it('is deterministic for the same roster', () => {
    const roster = members(6);
    assert.deepEqual(composeClubPortraits(roster), composeClubPortraits(roster));
    assert.deepEqual(composeClubPortraits(roster), composeClubPortraits(roster));
  });

  it('keeps a single portrait compact and close to the identity', () => {
    const composition = composeClubPortraits(members(1));
    assert.equal(composition.slots.length, 1);
    const slot = composition.slots[0];
    assert.ok(slot);
    assert.equal(slot.overflow, false);
    assert.ok(slot.size >= 68 && slot.size <= 76);
    const center = slot.x + slot.size / 2;
    assert.ok(Math.abs(center - composition.canvasWidth / 2) <= 8);
    assert.ok(composition.canvasHeight <= 92);
    assert.ok(slot.y <= 8);
    assert.equal(composition.canvasHeight, slot.y + slot.size + CLUB_PORTRAIT_BOTTOM_PAD);
  });

  it('makes two members overlap intentionally', () => {
    const composition = composeClubPortraits(members(2));
    assert.equal(composition.slots.length, 2);
    assert.equal(composition.slots.every((slot) => !slot.overflow), true);
    const [first, second] = composition.slots;
    assert.ok(first && second);
    assert.ok(first.size !== second.size);
    assert.ok(overlap(first, second));
    assert.ok(composition.canvasHeight < composeClubPortraits(members(4)).canvasHeight);
  });

  it('clusters three members without overflow', () => {
    const composition = composeClubPortraits(members(3));
    assert.equal(composition.slots.length, 3);
    assert.equal(composition.slots.every((slot) => !slot.overflow), true);
  });

  it('caps visible faces and uses +N for larger clubs', () => {
    const five = composeClubPortraits(members(5));
    const six = composeClubPortraits(members(6));
    const people = six.slots.filter((slot) => !slot.overflow);
    const overflow = six.slots.find((slot) => slot.overflow);
    assert.equal(people.length, CLUB_PORTRAIT_MAX_VISIBLE);
    assert.ok(overflow);
    assert.equal(overflow.overflowCount, 2);
    assert.equal(overflow.initials, '+2');
    assert.equal(overflow.memberId, null);
    assert.equal(five.slots.find((slot) => slot.overflow)?.overflowCount, 1);
    assert.ok(overflow.size < 42);
    assert.ok(overflow.x + overflow.size <= six.canvasWidth);
    assert.ok(overflow.y + overflow.size <= six.canvasHeight);
  });

  it('falls back to initials when a photo is missing', () => {
    const composition = composeClubPortraits([{ id: 'solo', initials: '' }]);
    assert.equal(composition.slots[0]?.initials, '?');
    assert.equal(resolveAvatarContent({}), 'initials');
  });

  it('keeps a stable canvas width and never clips slots', () => {
    for (const count of [1, 2, 3, 4, 6]) {
      const composition = composeClubPortraits(members(count));
      assert.equal(composition.canvasWidth, CLUB_PORTRAIT_CANVAS_WIDTH);
      for (const slot of composition.slots) {
        assert.ok(slot.x >= 0);
        assert.ok(slot.y >= 0);
        assert.ok(slot.x + slot.size <= composition.canvasWidth);
        assert.ok(slot.y + slot.size <= composition.canvasHeight);
      }
    }
  });
});
