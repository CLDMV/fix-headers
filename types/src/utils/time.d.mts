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
export declare function formatDateWithTimezone(date: Date): string;
/**
 * Returns a formatted date and unix timestamp.
 * @param {Date} [date=new Date()] - Date value to format.
 * @returns {{ date: string, timestamp: number }} Formatted datetime payload.
 */
export declare function toDatePayload(date?: Date): {
    date: string;
    timestamp: number;
};
/**
 * Parses a header datetime string into its wall-clock parts, UTC offset, and unix timestamp.
 * Calendar-invalid values (month 13, February 30, hour 24, ...) are rejected rather than rolled over.
 * @param {string} text - Datetime text as written in a header.
 * @returns {{ year: number, month: number, day: number, hour: number, minute: number, second: number, offsetMinutes: number, timestamp: number } | null} Parsed datetime, or null when unrecognised.
 */
export declare function parseHeaderDate(text: string): {
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
 * @param {{ year: number, month: number, day: number, hour: number, minute: number, second: number, offsetMinutes: number }} parts - Parsed datetime parts.
 * @returns {string} ISO 8601 datetime text.
 */
export declare function formatIsoDate(parts: {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
    second: number;
    offsetMinutes: number;
}): string;
