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
