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
export function formatDateWithTimezone(date) {
	const pad = (value) => String(value).padStart(2, "0");
	const tzOffset = -date.getTimezoneOffset();
	const sign = tzOffset >= 0 ? "+" : "-";
	const tzHours = pad(Math.floor(Math.abs(tzOffset) / 60));
	const tzMinutes = pad(Math.abs(tzOffset) % 60);

	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())} ${sign}${tzHours}:${tzMinutes}`;
}

/**
 * Returns a formatted date and unix timestamp.
 * @param {Date} [date=new Date()] - Date value to format.
 * @returns {{ date: string, timestamp: number }} Formatted datetime payload.
 */
export function toDatePayload(date = new Date()) {
	return {
		date: formatDateWithTimezone(date),
		timestamp: Math.floor(date.getTime() / 1000)
	};
}

/**
 * Matches the header datetime shapes: the git `%aI` form (`2026-03-01T17:59:32-08:00`), the
 * space form written by {@link formatDateWithTimezone} (`2026-03-01 17:59:32 -08:00`), an optional
 * fractional second, and a `Z` / `±HH:MM` / `±HHMM` offset. A datetime without an offset is
 * deliberately not matched: its instant depends on the reader's timezone.
 * @type {RegExp}
 */
const HEADER_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})(?:T|\s+)(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?\s*(?:(Z)|([+-])(\d{2}):?(\d{2}))$/i;

/**
 * Parses a header datetime string into its wall-clock parts, UTC offset, and unix timestamp.
 * Calendar-invalid values (month 13, February 30, hour 24, ...) are rejected rather than rolled over.
 * @param {string} text - Datetime text as written in a header.
 * @returns {{ year: number, month: number, day: number, hour: number, minute: number, second: number, offsetMinutes: number, timestamp: number } | null} Parsed datetime, or null when unrecognised.
 */
export function parseHeaderDate(text) {
	const match = HEADER_DATE_PATTERN.exec(text.trim());
	if (!match) {
		return null;
	}

	const [year, month, day, hour, minute, second] = match.slice(1, 7).map(Number);
	const offsetMagnitude = match[7] ? 0 : Number(match[9]) * 60 + Number(match[10]);
	const offsetMinutes = match[8] === "-" ? -offsetMagnitude : offsetMagnitude;
	const wallClock = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
	const isCalendarValid =
		wallClock.getUTCFullYear() === year &&
		wallClock.getUTCMonth() === month - 1 &&
		wallClock.getUTCDate() === day &&
		wallClock.getUTCHours() === hour &&
		wallClock.getUTCMinutes() === minute &&
		wallClock.getUTCSeconds() === second;
	if (!isCalendarValid || Number(match[10] ?? 0) > 59) {
		return null;
	}

	return {
		year,
		month,
		day,
		hour,
		minute,
		second,
		offsetMinutes,
		timestamp: Math.floor(wallClock.getTime() / 1000) - offsetMinutes * 60
	};
}

/**
 * Renders parsed datetime parts in the git `%aI` form (`YYYY-MM-DDTHH:mm:ss±HH:MM`), keeping the original offset.
 * @param {{ year: number, month: number, day: number, hour: number, minute: number, second: number, offsetMinutes: number }} parts - Parsed datetime parts.
 * @returns {string} ISO 8601 datetime text.
 */
export function formatIsoDate(parts) {
	const pad = (value) => String(value).padStart(2, "0");
	const sign = parts.offsetMinutes >= 0 ? "+" : "-";
	const offset = Math.abs(parts.offsetMinutes);

	return `${String(parts.year).padStart(4, "0")}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hour)}:${pad(parts.minute)}:${pad(parts.second)}${sign}${pad(Math.floor(offset / 60))}:${pad(offset % 60)}`;
}
