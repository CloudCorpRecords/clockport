/**
 * clockport core: current time and time conversion between IANA zones.
 *
 * Implemented with Intl.DateTimeFormat and Node stdlib only. All zone
 * arithmetic derives the UTC offset of a zone at a given instant from
 * Intl's own rendering of that instant, so daylight-saving rules come
 * from the platform's IANA database rather than a bundled table.
 *
 * convert_time has no date in its input, so it uses today's date (in
 * the source zone) as the reference date. Callers that need a fixed
 * reference — tests, for example — can pass one explicitly.
 */
import type { ConvertTimeResult, CurrentTimeResult } from "./types.js";

export const VERSION = "0.1.0";

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function validateTimezone(timezone: string): string {
  const tz = typeof timezone === "string" ? timezone.trim() : "";
  if (!tz) throw new Error("Invalid timezone: '' (expected an IANA timezone name)");
  try {
    // Throws RangeError for a name the platform does not know.
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
  } catch {
    throw new Error(`Invalid timezone: '${timezone}'`);
  }
  return tz;
}

export function parseTimeOfDay(time: string): { hour: number; minute: number } {
  const m = typeof time === "string" ? TIME_RE.exec(time.trim()) : null;
  if (!m) {
    throw new Error(`Invalid time format: '${time}' (expected HH:MM, 24-hour)`);
  }
  return { hour: Number(m[1]), minute: Number(m[2]) };
}

interface ZoneParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekday: string;
}

function partsInZone(date: Date, timeZone: string): ZoneParts {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
    weekday: "long",
  });
  const out: Record<string, string> = {};
  for (const p of fmt.formatToParts(date)) out[p.type] = p.value;
  return {
    year: Number(out.year),
    month: Number(out.month),
    day: Number(out.day),
    // h23 can render midnight as "24" in some engines; normalise it.
    hour: Number(out.hour) % 24,
    minute: Number(out.minute),
    second: Number(out.second),
    weekday: out.weekday ?? "",
  };
}

/** UTC offset of a zone at an instant, in minutes (e.g. -300 for EST). */
export function utcOffsetMinutes(date: Date, timeZone: string): number {
  const p = partsInZone(date, timeZone);
  const wallAsUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  const truncated = Math.floor(date.getTime() / 1000) * 1000;
  return Math.round((wallAsUtc - truncated) / 60000);
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function formatOffset(minutes: number): string {
  const sign = minutes < 0 ? "-" : "+";
  const abs = Math.abs(minutes);
  return `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}

function isoInZone(date: Date, timeZone: string): string {
  const p = partsInZone(date, timeZone);
  return (
    `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}:${pad(p.second)}` +
    formatOffset(utcOffsetMinutes(date, timeZone))
  );
}

function wallInZone(date: Date, timeZone: string): string {
  const p = partsInZone(date, timeZone);
  return `${p.year}-${pad(p.month)}-${pad(p.day)} ${pad(p.hour)}:${pad(p.minute)}:${pad(p.second)}`;
}

/**
 * Whether a zone is observing daylight saving at an instant, inferred by
 * comparing its offset with the offsets six months either side: DST is
 * the larger of the offsets a zone uses across a year (northern-hemisphere
 * convention; zones that never change offset are never in DST).
 */
function isDst(date: Date, timeZone: string): boolean {
  const here = utcOffsetMinutes(date, timeZone);
  const jan = utcOffsetMinutes(new Date(Date.UTC(date.getUTCFullYear(), 0, 15)), timeZone);
  const jul = utcOffsetMinutes(new Date(Date.UTC(date.getUTCFullYear(), 6, 15)), timeZone);
  return here > Math.min(jan, jul);
}

/**
 * Find the UTC instant for a wall-clock time in a zone. Start from the
 * wall time read as UTC, subtract the zone's offset at that guess, then
 * refine once — offsets only change at DST transitions, so a second
 * pass lands on the right offset except inside a transition gap/overlap,
 * where the refined value is still a consistent answer.
 */
function zonedTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
): Date {
  let utc = Date.UTC(year, month - 1, day, hour, minute, 0);
  for (let i = 0; i < 2; i++) {
    const offset = utcOffsetMinutes(new Date(utc), timeZone);
    const next = Date.UTC(year, month - 1, day, hour, minute, 0) - offset * 60000;
    if (next === utc) break;
    utc = next;
  }
  return new Date(utc);
}

export function getCurrentTime(
  timezone: string,
  now: Date = new Date(),
): CurrentTimeResult {
  const tz = validateTimezone(timezone);
  const p = partsInZone(now, tz);
  return {
    timezone: tz,
    current_time: wallInZone(now, tz),
    iso8601: isoInZone(now, tz),
    weekday: p.weekday,
    utc_offset_minutes: utcOffsetMinutes(now, tz),
    is_dst: isDst(now, tz),
  };
}

export function convertTime(
  sourceTimezone: string,
  time: string,
  targetTimezone: string,
  referenceDate: Date = new Date(),
): ConvertTimeResult {
  const source = validateTimezone(sourceTimezone);
  const target = validateTimezone(targetTimezone);
  const { hour, minute } = parseTimeOfDay(time);

  // Reference date is "today" in the source zone.
  const ref = partsInZone(referenceDate, source);
  const instant = zonedTimeToUtc(ref.year, ref.month, ref.day, hour, minute, source);

  const targetParts = partsInZone(instant, target);
  const sourceOffset = utcOffsetMinutes(instant, source);
  const targetOffset = utcOffsetMinutes(instant, target);
  const diffMinutes = targetOffset - sourceOffset;
  const diffHours = diffMinutes / 60;
  const timeDifference =
    (diffMinutes >= 0 ? "+" : "-") +
    (Number.isInteger(diffHours) ? String(Math.abs(diffHours)) : String(Math.abs(diffHours))) +
    "h";

  return {
    source_timezone: source,
    target_timezone: target,
    reference_date: `${ref.year}-${pad(ref.month)}-${pad(ref.day)}`,
    source_time: `${ref.year}-${pad(ref.month)}-${pad(ref.day)} ${pad(hour)}:${pad(minute)}`,
    converted_time: `${pad(targetParts.hour)}:${pad(targetParts.minute)}`,
    target_time:
      `${targetParts.year}-${pad(targetParts.month)}-${pad(targetParts.day)} ` +
      `${pad(targetParts.hour)}:${pad(targetParts.minute)}`,
    iso8601: isoInZone(instant, target),
    time_difference: timeDifference,
  };
}
