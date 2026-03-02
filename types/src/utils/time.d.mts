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
 * Returns a formatted date and unix timestamp.
 * @param {Date} [date=new Date()] - Date value to format.
 * @returns {{ date: string, timestamp: number }} Formatted datetime payload.
 */
export function toDatePayload(date?: Date): {
    date: string;
    timestamp: number;
};
