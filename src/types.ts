/**
 * clockport types.
 *
 * Results carry both a human-readable rendering and the pieces a caller
 * needs to act on it: the zone that was asked for, the wall-clock time in
 * that zone, and an ISO 8601 rendering with the zone's UTC offset applied.
 */

export interface CurrentTimeResult {
  timezone: string;
  /** Wall-clock time in the requested zone: YYYY-MM-DD HH:MM:SS */
  current_time: string;
  /** Same instant as ISO 8601 with the zone offset, e.g. 2026-01-15T07:00:00-05:00 */
  iso8601: string;
  /** Weekday in the requested zone, e.g. "Thursday". */
  weekday: string;
  /** UTC offset in minutes for the requested zone at this instant. */
  utc_offset_minutes: number;
  is_dst: boolean;
}

export interface ConvertTimeResult {
  source_timezone: string;
  target_timezone: string;
  /** Reference calendar date used for the conversion, in the source zone: YYYY-MM-DD */
  reference_date: string;
  /** The requested time on the reference date, in the source zone: YYYY-MM-DD HH:MM */
  source_time: string;
  /** Converted wall-clock time in the target zone: HH:MM */
  converted_time: string;
  /** Converted time with its calendar date in the target zone: YYYY-MM-DD HH:MM */
  target_time: string;
  /** ISO 8601 rendering of the converted instant with the target zone offset. */
  iso8601: string;
  /** Signed difference between the target and source offsets, e.g. "+5h" / "-3.5h". */
  time_difference: string;
}
