import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  PARTICIPATION_PRIVACY_INFO,
  PARTICIPATION_REPORTING_INFO,
  participationCopyContainsForbidden,
  participationCopyContainsPrivateFinance,
  participationShowsBrokerPreference,
  presentClubOverviewParticipation,
  presentInvestmentDayParticipation,
  presentParticipationCount,
  presentParticipationMember,
  presentParticipationStatus,
  presentParticipationStreak,
} from './presentParticipation.ts';

describe('investment day participation presentation', () => {
  it('formats completed member state with a quiet streak', () => {
    const member = presentParticipationMember({
      displayName: 'Nicklas Berg',
      completed: true,
      currentStreak: 6,
    });

    assert.equal(member.firstName, 'Nicklas');
    assert.equal(member.statusLabel, 'Reported');
    assert.equal(member.streakLabel, '🔥 6');
    assert.equal(member.showStreak, true);
    assert.equal(presentParticipationStatus(true), 'Reported');
  });

  it('keeps pending members muted and still shows a prior streak', () => {
    const member = presentParticipationMember({
      displayName: 'Espen Lien',
      completed: false,
      currentStreak: 3,
    });

    assert.equal(member.firstName, 'Espen');
    assert.equal(member.statusLabel, 'Pending');
    assert.equal(member.streakLabel, '🔥 3');
    assert.equal(member.showStreak, true);
    assert.equal(presentParticipationStatus(false), 'Pending');
  });

  it('hides a zero streak instead of showing a failure badge', () => {
    const member = presentParticipationMember({
      displayName: 'Anna',
      completed: false,
      currentStreak: 0,
    });

    assert.equal(member.streakLabel, null);
    assert.equal(member.showStreak, false);
    assert.equal(presentParticipationStreak(0), null);
  });

  it('presents club progress and the all-completed state', () => {
    const open = presentInvestmentDayParticipation({
      completedCount: 4,
      totalCount: 6,
      allCompleted: false,
    });
    const done = presentInvestmentDayParticipation({
      completedCount: 6,
      totalCount: 6,
      allCompleted: true,
    });

    assert.equal(open.title, 'Club progress');
    assert.equal(open.countLabel, '4 of 6 reported');
    assert.equal(open.allCompletedTitle, null);
    assert.equal(done.allCompletedTitle, 'Everyone has reported 🎉');
    assert.equal(done.allCompletedSubtitle, '6 of 6 completed');
    assert.equal(presentParticipationCount(4, 6), '4 of 6 reported');
  });

  it('keeps the Club Overview surface compact', () => {
    const compact = presentClubOverviewParticipation({
      completedCount: 4,
      totalCount: 6,
      allCompleted: false,
    });
    const done = presentClubOverviewParticipation({
      completedCount: 6,
      totalCount: 6,
      allCompleted: true,
    });

    assert.equal(compact.countLabel, '4 of 6 reported');
    assert.equal(compact.allCompletedLabel, null);
    assert.equal(done.allCompletedLabel, 'Everyone has reported');
    assert.equal('streakLabel' in compact, false);
  });

  it('explains member-reported status and privacy without private finance', () => {
    const presented = presentInvestmentDayParticipation({
      completedCount: 1,
      totalCount: 1,
      allCompleted: true,
    });
    const member = presentParticipationMember({
      displayName: 'Nicklas Berg',
      completed: true,
      currentStreak: 4,
    });
    const visible = [
      presented.title,
      presented.countLabel,
      presented.allCompletedTitle,
      presented.allCompletedSubtitle,
      presented.privacyInfo,
      presented.reportingInfo,
      member.firstName,
      member.statusLabel,
      member.streakLabel,
      presentClubOverviewParticipation({
        completedCount: 4,
        totalCount: 6,
        allCompleted: false,
      }).countLabel,
    ].join(' ');

    assert.equal(presented.privacyInfo, PARTICIPATION_PRIVACY_INFO);
    assert.equal(presented.reportingInfo, PARTICIPATION_REPORTING_INFO);
    assert.match(presented.privacyInfo, /not amounts/i);
    assert.match(presented.reportingInfo, /not verified by the broker/i);
    assert.equal(participationCopyContainsForbidden(visible), false);
    assert.equal(participationCopyContainsPrivateFinance(visible), false);
    assert.equal(participationShowsBrokerPreference(visible), false);
    assert.equal(participationCopyContainsForbidden('winning streak'), true);
    assert.equal(participationCopyContainsPrivateFinance('1200 kr · Nordnet'), true);
    assert.equal(participationShowsBrokerPreference('Open Nordnet'), true);
  });
});
