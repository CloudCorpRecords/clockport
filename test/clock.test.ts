import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  convertTime,
  getCurrentTime,
  parseTimeOfDay,
  utcOffsetMinutes,
  validateTimezone,
} from "../src/clock.js";

describe("validateTimezone", () => {
  it("accepts known IANA zones", () => {
    assert.equal(validateTimezone("America/New_York"), "America/New_York");
    assert.equal(validateTimezone("Europe/London"), "Europe/London");
    assert.equal(validateTimezone("UTC"), "UTC");
  });

  it("rejects unknown zones", () => {
    assert.throws(() => validateTimezone("Not/AZone"), /Invalid timezone/);
    assert.throws(() => validateTimezone("Mars/Olympus"), /Invalid timezone/);
    assert.throws(() => validateTimezone(""), /Invalid timezone/);
  });
});

describe("parseTimeOfDay", () => {
  it("parses HH:MM", () => {
    assert.deepEqual(parseTimeOfDay("00:00"), { hour: 0, minute: 0 });
    assert.deepEqual(parseTimeOfDay("12:00"), { hour: 12, minute: 0 });
    assert.deepEqual(parseTimeOfDay("23:59"), { hour: 23, minute: 59 });
  });

  it("rejects malformed times", () => {
    for (const bad of ["24:00", "12:60", "9:00", "12-00", "noon", "", "12:00:00"]) {
      assert.throws(() => parseTimeOfDay(bad), /Invalid time format/, bad);
    }
  });
});

describe("getCurrentTime", () => {
  it("renders a fixed instant in the requested zone", () => {
    // 2026-01-15T12:00:00Z is 07:00 EST in New York (UTC-5, standard time).
    const r = getCurrentTime("America/New_York", new Date("2026-01-15T12:00:00Z"));
    assert.equal(r.timezone, "America/New_York");
    assert.equal(r.current_time, "2026-01-15 07:00:00");
    assert.equal(r.iso8601, "2026-01-15T07:00:00-05:00");
    assert.equal(r.weekday, "Thursday");
    assert.equal(r.utc_offset_minutes, -300);
    assert.equal(r.is_dst, false);
  });

  it("renders the same instant in UTC and Tokyo", () => {
    const instant = new Date("2026-01-15T12:00:00Z");
    assert.equal(getCurrentTime("UTC", instant).current_time, "2026-01-15 12:00:00");
    assert.equal(getCurrentTime("Asia/Tokyo", instant).current_time, "2026-01-15 21:00:00");
    assert.equal(getCurrentTime("Asia/Tokyo", instant).utc_offset_minutes, 540);
  });

  it("reports DST in summer", () => {
    const r = getCurrentTime("America/New_York", new Date("2026-07-15T12:00:00Z"));
    assert.equal(r.current_time, "2026-07-15 08:00:00");
    assert.equal(r.utc_offset_minutes, -240);
    assert.equal(r.is_dst, true);
  });

  it("throws on an invalid timezone", () => {
    assert.throws(() => getCurrentTime("Nowhere/Special"), /Invalid timezone/);
  });
});

describe("convertTime", () => {
  it("converts 12:00 New York to 17:00 London on a fixed winter reference", () => {
    // Reference instant falls on 2026-01-15 in New York: EST (UTC-5)
    // to GMT (UTC+0) is a five-hour difference.
    const r = convertTime(
      "America/New_York",
      "12:00",
      "Europe/London",
      new Date("2026-01-15T18:00:00Z"),
    );
    assert.equal(r.reference_date, "2026-01-15");
    assert.equal(r.source_time, "2026-01-15 12:00");
    assert.equal(r.converted_time, "17:00");
    assert.equal(r.target_time, "2026-01-15 17:00");
    assert.equal(r.iso8601, "2026-01-15T17:00:00+00:00");
    assert.equal(r.time_difference, "+5h");
  });

  it("converts 12:00 New York to 17:00 London on a fixed summer reference", () => {
    // 2026-07-15: EDT (UTC-4) to BST (UTC+1) is still five hours.
    const r = convertTime(
      "America/New_York",
      "12:00",
      "Europe/London",
      new Date("2026-07-15T18:00:00Z"),
    );
    assert.equal(r.converted_time, "17:00");
    assert.equal(r.iso8601, "2026-07-15T17:00:00+01:00");
  });

  it("rolls the target date forward when the conversion crosses midnight", () => {
    const r = convertTime(
      "America/New_York",
      "23:00",
      "Europe/London",
      new Date("2026-01-15T18:00:00Z"),
    );
    assert.equal(r.converted_time, "04:00");
    assert.equal(r.target_time, "2026-01-16 04:00");
  });

  it("converts westward with a negative difference", () => {
    const r = convertTime(
      "Europe/London",
      "12:00",
      "America/New_York",
      new Date("2026-01-15T12:00:00Z"),
    );
    assert.equal(r.converted_time, "07:00");
    assert.equal(r.time_difference, "-5h");
  });

  it("handles half-hour offsets", () => {
    // 12:00 UTC on 2026-01-15 is 17:30 in Asia/Kolkata (UTC+5:30).
    const r = convertTime("UTC", "12:00", "Asia/Kolkata", new Date("2026-01-15T00:00:00Z"));
    assert.equal(r.converted_time, "17:30");
    assert.equal(r.time_difference, "+5.5h");
  });

  it("throws on invalid timezones", () => {
    assert.throws(() => convertTime("Bad/Zone", "12:00", "Europe/London"), /Invalid timezone/);
    assert.throws(() => convertTime("UTC", "12:00", "Bad/Zone"), /Invalid timezone/);
  });

  it("throws on invalid time formats", () => {
    assert.throws(() => convertTime("UTC", "25:00", "Europe/London"), /Invalid time format/);
    assert.throws(() => convertTime("UTC", "12-00", "Europe/London"), /Invalid time format/);
  });
});

describe("utcOffsetMinutes", () => {
  it("matches known offsets", () => {
    const winter = new Date("2026-01-15T12:00:00Z");
    assert.equal(utcOffsetMinutes(winter, "UTC"), 0);
    assert.equal(utcOffsetMinutes(winter, "America/New_York"), -300);
    assert.equal(utcOffsetMinutes(winter, "Asia/Kolkata"), 330);
  });
});
