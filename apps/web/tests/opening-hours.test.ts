import { describe, it } from 'node:test';
import assert from 'node:assert';
import type { OperatingHours } from '@jubilee/shared';
import {
  getTenantOpeningStatus,
  parseTimeToMinutes,
  formatTimeShort,
} from '../src/lib/opening-hours.js';

describe('Jubilee Square Opening Hours Engine Suite', () => {
  const standardSchedule: OperatingHours[] = [
    { dayOfWeek: 0, dayName: 'Sunday', openTime: '10:00:00', closeTime: '22:00:00', isClosed: false },
    { dayOfWeek: 1, dayName: 'Monday', openTime: '10:00:00', closeTime: '22:00:00', isClosed: false },
    { dayOfWeek: 2, dayName: 'Tuesday', openTime: '10:00:00', closeTime: '22:00:00', isClosed: false },
    { dayOfWeek: 3, dayName: 'Wednesday', openTime: '10:00:00', closeTime: '22:00:00', isClosed: true }, // Wednesday closed
    { dayOfWeek: 4, dayName: 'Thursday', openTime: '10:00:00', closeTime: '22:00:00', isClosed: false },
    { dayOfWeek: 5, dayName: 'Friday', openTime: '10:00:00', closeTime: '22:00:00', isClosed: false },
    { dayOfWeek: 6, dayName: 'Saturday', openTime: '10:00:00', closeTime: '22:00:00', isClosed: false },
  ];

  const midnightCrossSchedule: OperatingHours[] = [
    { dayOfWeek: 5, dayName: 'Friday', openTime: '18:00:00', closeTime: '02:00:00', isClosed: false },
    { dayOfWeek: 6, dayName: 'Saturday', openTime: '18:00:00', closeTime: '02:00:00', isClosed: false },
  ];

  it('parses time strings to total minutes accurately', () => {
    assert.strictEqual(parseTimeToMinutes('00:00:00'), 0);
    assert.strictEqual(parseTimeToMinutes('10:30:00'), 630);
    assert.strictEqual(parseTimeToMinutes('18:00'), 1080);
    assert.strictEqual(parseTimeToMinutes('02:00:00'), 120);
    assert.strictEqual(parseTimeToMinutes(null), null);
    assert.strictEqual(parseTimeToMinutes('invalid'), null);
  });

  it('formats short time string cleanly', () => {
    assert.strictEqual(formatTimeShort('10:00:00'), '10:00');
    assert.strictEqual(formatTimeShort('21:30:00'), '21:30');
    assert.strictEqual(formatTimeShort('8:45:00'), '08:45');
    assert.strictEqual(formatTimeShort(null, '10:00'), '10:00');
  });

  it('returns open status during standard operating hours', () => {
    // Monday at 14:30
    const testDate = new Date('2026-09-07T14:30:00'); // 2026-09-07 was Monday
    const status = getTenantOpeningStatus(standardSchedule, testDate);
    assert.strictEqual(status.isOpen, true);
    assert.strictEqual(status.statusBadge, 'open');
    assert.strictEqual(status.closeTimeFormatted, '22:00');
  });

  it('returns closed status before standard opening time', () => {
    // Monday at 08:30
    const testDate = new Date('2026-09-07T08:30:00');
    const status = getTenantOpeningStatus(standardSchedule, testDate);
    assert.strictEqual(status.isOpen, false);
    assert.strictEqual(status.statusBadge, 'closed');
    assert.strictEqual(status.openTimeFormatted, '10:00');
  });

  it('returns closed status after standard closing time', () => {
    // Monday at 23:15
    const testDate = new Date('2026-09-07T23:15:00');
    const status = getTenantOpeningStatus(standardSchedule, testDate);
    assert.strictEqual(status.isOpen, false);
    assert.strictEqual(status.statusBadge, 'closed');
  });

  it('returns closed status for a designated closed day', () => {
    // Wednesday at 14:00 (isClosed: true)
    const testDate = new Date('2026-09-09T14:00:00'); // Wednesday
    const status = getTenantOpeningStatus(standardSchedule, testDate);
    assert.strictEqual(status.isOpen, false);
    assert.strictEqual(status.statusBadge, 'closed');
    assert.strictEqual(status.statusText, 'Closed Today');
  });

  it('handles midnight crossover: returns open during Friday evening shift', () => {
    // Friday at 21:00
    const testDate = new Date('2026-09-11T21:00:00'); // Friday
    const status = getTenantOpeningStatus(midnightCrossSchedule, testDate);
    assert.strictEqual(status.isOpen, true);
    assert.strictEqual(status.statusBadge, 'open');
    assert.strictEqual(status.closeTimeFormatted, '02:00');
  });

  it('handles midnight crossover: returns open during Saturday early morning rollover (01:30 AM)', () => {
    // Saturday at 01:30 (rollover from Friday evening shift)
    const testDate = new Date('2026-09-12T01:30:00'); // Saturday early morning
    const status = getTenantOpeningStatus(midnightCrossSchedule, testDate);
    assert.strictEqual(status.isOpen, true);
    assert.strictEqual(status.statusBadge, 'open');
    assert.strictEqual(status.closeTimeFormatted, '02:00');
  });

  it('handles midnight crossover: returns closed on Saturday morning after overnight shift closed', () => {
    // Saturday at 10:00 AM (after 02:00 AM close and before 18:00 start)
    const testDate = new Date('2026-09-12T10:00:00');
    const status = getTenantOpeningStatus(midnightCrossSchedule, testDate);
    assert.strictEqual(status.isOpen, false);
    assert.strictEqual(status.statusBadge, 'closed');
  });

  it('defaults to standard mall operating hours when schedule is undefined', () => {
    const dayDate = new Date('2026-09-09T12:00:00');
    const statusDay = getTenantOpeningStatus(undefined, dayDate);
    assert.strictEqual(statusDay.isOpen, true);

    const nightDate = new Date('2026-09-09T03:00:00');
    const statusNight = getTenantOpeningStatus(undefined, nightDate);
    assert.strictEqual(statusNight.isOpen, false);
  });
});
