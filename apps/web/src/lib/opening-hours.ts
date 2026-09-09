import type { OperatingHours } from '@jubilee/shared';

export const DAYS_OF_WEEK = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

export interface OpeningStatusResult {
  isOpen: boolean;
  statusBadge: 'open' | 'closed';
  statusText: string;
  badgeText: string;
  openTimeFormatted: string;
  closeTimeFormatted: string;
  todaySchedule?: OperatingHours;
}

/**
 * Parses "HH:MM" or "HH:MM:SS" into total minutes from midnight (0..1439).
 */
export function parseTimeToMinutes(timeStr: string | null | undefined): number | null {
  if (!timeStr || typeof timeStr !== 'string') return null;
  const parts = timeStr.trim().split(':');
  if (parts.length < 2) return null;
  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  if (isNaN(hours) || isNaN(minutes)) return null;
  return hours * 60 + minutes;
}

/**
 * Formats a raw time string (e.g. "10:00:00") to 5-character "HH:MM".
 */
export function formatTimeShort(timeStr: string | null | undefined, fallback: string = '10:00'): string {
  if (!timeStr) return fallback;
  const match = timeStr.match(/^(\d{1,2}:\d{2})/);
  return match ? match[1].padStart(5, '0') : fallback;
}

/**
 * Evaluates whether a tenant is currently open given their weekly operating schedule and a target Date.
 * Handles:
 *  - Regular same-day shifts (e.g. 10:00 - 22:00)
 *  - Overnight shifts that cross midnight (e.g. 18:00 - 02:00)
 *  - Rollover early morning hours continuing from yesterday's overnight shift
 *  - Closed days (`isClosed: true`)
 *  - Fallback default hours when schedule is empty
 */
export function getTenantOpeningStatus(
  operatingHours?: OperatingHours[] | null,
  targetDate: Date = new Date()
): OpeningStatusResult {
  const currentDay = targetDate.getDay();
  const currentMinutes = targetDate.getHours() * 60 + targetDate.getMinutes();

  const todaySchedule = operatingHours?.find((h) => h.dayOfWeek === currentDay);
  const yesterdayDay = (currentDay + 6) % 7;
  const yesterdaySchedule = operatingHours?.find((h) => h.dayOfWeek === yesterdayDay);

  let isOpen = false;
  let activeOpenStr = '10:00';
  let activeCloseStr = '21:30';

  // 1. Check if we are in the early-morning rollover of yesterday's overnight shift
  if (yesterdaySchedule && !yesterdaySchedule.isClosed && yesterdaySchedule.openTime && yesterdaySchedule.closeTime) {
    const yOpenMins = parseTimeToMinutes(yesterdaySchedule.openTime);
    const yCloseMins = parseTimeToMinutes(yesterdaySchedule.closeTime);

    if (yOpenMins !== null && yCloseMins !== null && yCloseMins < yOpenMins) {
      // Yesterday crossed midnight into today morning
      if (currentMinutes < yCloseMins) {
        isOpen = true;
        activeOpenStr = formatTimeShort(yesterdaySchedule.openTime, '18:00');
        activeCloseStr = formatTimeShort(yesterdaySchedule.closeTime, '02:00');
        return {
          isOpen: true,
          statusBadge: 'open',
          statusText: `Open • Closes ${activeCloseStr}`,
          badgeText: 'Open Now',
          openTimeFormatted: activeOpenStr,
          closeTimeFormatted: activeCloseStr,
          todaySchedule,
        };
      }
    }
  }

  // 2. Evaluate today's schedule
  if (todaySchedule) {
    if (todaySchedule.isClosed) {
      return {
        isOpen: false,
        statusBadge: 'closed',
        statusText: 'Closed Today',
        badgeText: 'Closed Today',
        openTimeFormatted: 'Closed',
        closeTimeFormatted: 'Closed',
        todaySchedule,
      };
    }

    const tOpenMins = parseTimeToMinutes(todaySchedule.openTime);
    const tCloseMins = parseTimeToMinutes(todaySchedule.closeTime);
    activeOpenStr = formatTimeShort(todaySchedule.openTime, '10:00');
    activeCloseStr = formatTimeShort(todaySchedule.closeTime, '21:30');

    if (tOpenMins !== null && tCloseMins !== null) {
      if (tCloseMins >= tOpenMins) {
        // Standard daytime shift
        if (currentMinutes >= tOpenMins && currentMinutes < tCloseMins) {
          isOpen = true;
        }
      } else {
        // Overnight shift starting today and crossing midnight
        if (currentMinutes >= tOpenMins) {
          isOpen = true;
        }
      }
    } else {
      // Default standard hours if timestamps unparseable
      if (currentMinutes >= 600 && currentMinutes < 1290) {
        isOpen = true;
      }
    }
  } else {
    // Default 10:00 - 21:30 when no specific hours array
    const defaultOpen = 10 * 60; // 600
    const defaultClose = 21 * 60 + 30; // 1290
    if (currentMinutes >= defaultOpen && currentMinutes < defaultClose) {
      isOpen = true;
    }
  }

  if (isOpen) {
    return {
      isOpen: true,
      statusBadge: 'open',
      statusText: `Open • Closes ${activeCloseStr}`,
      badgeText: 'Open Today',
      openTimeFormatted: activeOpenStr,
      closeTimeFormatted: activeCloseStr,
      todaySchedule,
    };
  } else {
    return {
      isOpen: false,
      statusBadge: 'closed',
      statusText: `Closed • Opens ${activeOpenStr}`,
      badgeText: 'Closed Now',
      openTimeFormatted: activeOpenStr,
      closeTimeFormatted: activeCloseStr,
      todaySchedule,
    };
  }
}
