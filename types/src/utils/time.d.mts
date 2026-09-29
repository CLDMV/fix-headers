/**
 *	@Project: @cldmv/fix-headers
 *	@Filename: /src/utils/time.mjs
 *	@Date: 2026-03-01T17:59:32-08:00 (1772416772)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-01T17:59:32-08:00 (1772416772)
 *	-----
 *	@Copyright: Copyright (c) 2026-2026 Catalyzed Motivation Inc. All rights reserved.
 */
/**
 * @fileoverview Date/time helpers used for header timestamp formatting.
 * @module fix-headers/utils/time
 */
/**
 * Formats a date as `YYYY-MM-DD HH:mm:ss ±HH:MM`.
 * @param {Date} date - Input date.
 * @returns {string} Formatted date string.
 */
export function formatDateWithTimezone(date: Date): string;
/**
 * Renders datetime parts in the space form (`YYYY-MM-DD HH:mm:ss ±HH:MM`), keeping their offset.
 * @param {DateParts} parts - Datetime parts.
 * @returns {string} Formatted date string.
 */
export function formatSpaceDate(parts: DateParts): string;
/**
 * Validates an IANA time zone name with Intl (`new Intl.DateTimeFormat` throws a RangeError for a
 * zone it does not know).
 * @param {unknown} timeZone - Zone name to validate, such as `America/Los_Angeles` or `UTC`.
 * @returns {string} The zone name.
 * @throws {Error} When the value is not a string, or Intl does not know the zone.
 */
export function assertTimeZone(timeZone: unknown): string;
/**
 * Expresses an instant in a zone: its wall-clock parts there and the zone's UTC offset at that
 * instant (DST included), read from Intl's time zone data rather than a fixed table. The offset is
 * the difference between that wall-clock time and the instant, so a historical offset that is not
 * a whole number of minutes (local mean time) comes back fractional.
 * @param {number} timestamp - Unix timestamp in seconds.
 * @param {string} timeZone - IANA zone name.
 * @returns {DateParts} Wall-clock parts and offset in the zone.
 */
export function toZonedDateParts(timestamp: number, timeZone: string): DateParts;
/**
 * Returns a formatted date and unix timestamp.
 * @param {Date} [date=new Date()] - Date value to format.
 * @returns {{ date: string, timestamp: number }} Formatted datetime payload.
 */
export function toDatePayload(date?: Date): {
    date: string;
    timestamp: number;
};
/**
 * Parses a header datetime string into its wall-clock parts, UTC offset, and unix timestamp.
 * Calendar-invalid values (month 13, February 30, hour 24, ...) are rejected rather than rolled over.
 * @param {string} text - Datetime text as written in a header.
 * @returns {{ year: number, month: number, day: number, hour: number, minute: number, second: number, offsetMinutes: number, timestamp: number } | null} Parsed datetime, or null when unrecognised.
 */
export function parseHeaderDate(text: string): {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
    second: number;
    offsetMinutes: number;
    timestamp: number;
} | null;
/**
 * Renders parsed datetime parts in the git `%aI` form (`YYYY-MM-DDTHH:mm:ss±HH:MM`), keeping the original offset.
 * @param {DateParts} parts - Parsed datetime parts.
 * @returns {string} ISO 8601 datetime text.
 */
export function formatIsoDate(parts: DateParts): string;
export type DateParts = {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
    second: number;
    offsetMinutes: number;
};
