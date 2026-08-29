/**
 * Professional software career start — iNBest, April 2023.
 *
 * Everything that states "N+ years of experience" derives from this constant at
 * build time, so the site never needs a manual edit as years pass. The deploy
 * workflow runs on a monthly schedule to keep the static build current.
 */
export const CAREER_START = { year: 2023, month: 4 } as const;

/**
 * Completed years of professional experience.
 *
 * Counts *completed* years rather than subtracting calendar years, so the "N+"
 * phrasing is never an overstatement — in January 2027 this returns 3, not 4.
 */
export function yearsOfExperience(now: Date = new Date()): number {
  const elapsedMonths =
    (now.getUTCFullYear() - CAREER_START.year) * 12 + (now.getUTCMonth() + 1 - CAREER_START.month);
  return Math.max(0, Math.floor(elapsedMonths / 12));
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

/** Formats a `YYYY-MM` string as `Mon YYYY`; a null end date reads as "Present". */
export function formatMonth(value: string | null): string {
  if (value === null) return 'Present';
  const [year, month] = value.split('-');
  return `${MONTHS[Number(month) - 1]} ${year}`;
}
