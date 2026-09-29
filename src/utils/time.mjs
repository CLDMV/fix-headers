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
	return formatSpaceDate({
		year: date.getFullYear(),
		month: date.getMonth() + 1,
		day: date.getDate(),
		hour: date.getHours(),
		minute: date.getMinutes(),
		second: date.getSeconds(),
		offsetMinutes: -date.getTimezoneOffset()
	});
}

/**
 * Renders datetime parts in the space form (`YYYY-MM-DD HH:mm:ss ±HH:MM`), keeping their offset.
 * @param {DateParts} parts - Datetime parts.
 * @returns {string} Formatted date string.
 */
export function formatSpaceDate(parts) {
	return `${formatWallClock(parts, " ")} ${formatOffset(parts.offsetMinutes)}`;
}

/**
 * Validates an IANA time zone name with Intl (`new Intl.DateTimeFormat` throws a RangeError for a
 * zone it does not know).
 * @param {unknown} timeZone - Zone name to validate, such as `America/Los_Angeles` or `UTC`.
 * @returns {string} The zone name.
 * @throws {Error} When the value is not a string, or Intl does not know the zone.
 */
export function assertTimeZone(timeZone) {
	if (typeof timeZone !== "string") {
		throw new Error(`timezone must be an IANA time zone name string, such as "America/Los_Angeles" or "UTC" (got ${typeof timeZone})`);
	}
	try {
		getZoneFormatter(timeZone);
	} catch (error) {
		// Intl rejects a zone name it does not know with a RangeError.
		throw new Error(`Unknown time zone "${timeZone}": expected an IANA time zone name, such as "America/Los_Angeles" or "UTC"`, {
			cause: error
		});
	}
	return timeZone;
}

/**
 * Intl formatters keyed by zone name, so a run formats every date of a zone with one formatter.
 * @type {Map<string, Intl.DateTimeFormat>}
 */
const zoneFormatters = new Map();

/**
 * Returns the cached formatter that renders an instant's wall-clock parts in a zone.
 * @param {string} timeZone - IANA zone name.
 * @returns {Intl.DateTimeFormat} Formatter for the zone.
 */
function getZoneFormatter(timeZone) {
	let formatter = zoneFormatters.get(timeZone);
	if (!formatter) {
		formatter = new Intl.DateTimeFormat("en-US", {
			timeZone,
			hourCycle: "h23",
			year: "numeric",
			month: "2-digit",
			day: "2-digit",
			hour: "2-digit",
			minute: "2-digit",
			second: "2-digit"
		});
		zoneFormatters.set(timeZone, formatter);
	}
	return formatter;
}

/**
 * Expresses an instant in a zone: its wall-clock parts there and the zone's UTC offset at that
 * instant (DST included), read from Intl's time zone data rather than a fixed table. The offset is
 * the difference between that wall-clock time and the instant, so a historical offset that is not
 * a whole number of minutes (local mean time) comes back fractional.
 * @param {number} timestamp - Unix timestamp in seconds.
 * @param {string} timeZone - IANA zone name.
 * @returns {DateParts} Wall-clock parts and offset in the zone.
 */
export function toZonedDateParts(timestamp, timeZone) {
	/** @type {Record<string, number>} */
	const values = {};
	for (const part of getZoneFormatter(timeZone).formatToParts(new Date(timestamp * 1000))) {
		values[part.type] = Number(part.value);
	}
	const wallClockSeconds = Date.UTC(values.year, values.month - 1, values.day, values.hour, values.minute, values.second) / 1000;

	return {
		year: values.year,
		month: values.month,
		day: values.day,
		hour: values.hour,
		minute: values.minute,
		second: values.second,
		offsetMinutes: (wallClockSeconds - timestamp) / 60
	};
}

/**
 * @typedef {{ year: number, month: number, day: number, hour: number, minute: number, second: number, offsetMinutes: number }} DateParts
 */

/**
 * Renders the date and time of datetime parts, joined by `separator`.
 * @param {DateParts} parts - Datetime parts.
 * @param {string} separator - `T` or a space.
 * @returns {string} `YYYY-MM-DD<separator>HH:mm:ss`.
 */
function formatWallClock(parts, separator) {
	const pad = (value) => String(value).padStart(2, "0");
	return `${String(parts.year).padStart(4, "0")}-${pad(parts.month)}-${pad(parts.day)}${separator}${pad(parts.hour)}:${pad(parts.minute)}:${pad(parts.second)}`;
}

/**
 * Renders a UTC offset in minutes as `±HH:MM`.
 * @param {number} offsetMinutes - Offset east of UTC, in minutes.
 * @returns {string} Offset text.
 */
function formatOffset(offsetMinutes) {
	const pad = (value) => String(value).padStart(2, "0");
	const offset = Math.abs(offsetMinutes);
	return `${offsetMinutes >= 0 ? "+" : "-"}${pad(Math.floor(offset / 60))}:${pad(offset % 60)}`;
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
 * @param {DateParts} parts - Parsed datetime parts.
 * @returns {string} ISO 8601 datetime text.
 */
export function formatIsoDate(parts) {
	return `${formatWallClock(parts, "T")}${formatOffset(parts.offsetMinutes)}`;
}
