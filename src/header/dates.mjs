/**
 *	@Project: @cldmv/fix-headers
 *	@Filename: /src/header/dates.mjs
 *	@Date: 2026-09-28T09:16:17-07:00 (1790612177)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-09-28T09:16:17-07:00 (1790612177)
 *	-----
 *	@Copyright: Copyright (c) 2026-2026 Catalyzed Motivation Inc. All rights reserved.
 */

import { formatIsoDate, parseHeaderDate } from "../utils/time.mjs";

/**
 * @fileoverview Header date validation: epoch/datetime consistency, git history comparison, and date repair/normalization.
 * @module fix-headers/header/dates
 */

/**
 * @typedef {{
 *  check: "created-format" | "created-epoch" | "created-git" | "modified-format" | "modified-epoch" | "modified-git",
 *  field: "@Date" | "@Last modified time",
 *  advisory: boolean,
 *  value: string,
 *  expected?: string,
 *  message: string
 * }} DateCheckIssue
 */

/**
 * Header date fields checked by {@link checkHeaderDates}, with the git date each one is compared against.
 * @type {Array<{ field: "@Date" | "@Last modified time", prefix: "created" | "modified", gitKey: "gitCreated" | "gitLastModified", gitLabel: string, advisory: boolean }>}
 */
const DATE_FIELDS = [
	{ field: "@Date", prefix: "created", gitKey: "gitCreated", gitLabel: "git first commit", advisory: false },
	{ field: "@Last modified time", prefix: "modified", gitKey: "gitLastModified", gitLabel: "git last commit", advisory: true }
];

/**
 * Reads the raw value of a header field, up to the end of its line.
 * @param {string} headerText - Existing header content.
 * @param {string} field - Field label including the leading `@`.
 * @returns {string | null} Trimmed value, or null when the field is absent.
 */
function readHeaderField(headerText, field) {
	const match = headerText.match(new RegExp(`${field}:[^\\S\\n]*(.*)$`, "m"));
	return match ? match[1].trim() : null;
}

/**
 * Validates the `@Date` and `@Last modified time` values of an existing header.
 *
 * Every comparison is between instants, so the same moment written with another offset or in
 * the space/`T` form is not drift. The checks are independent of the rendered-header diff, so
 * an author, identity, or other content difference never produces an issue here.
 * - `*-format`: the value is not a recognised `<datetime> (<epoch>)` pair.
 * - `*-epoch`: the parenthesised epoch is not the instant the datetime text describes.
 * - `created-git`: `@Date` is not the file's first-commit date (skipped without git history).
 * - `modified-git`: `@Last modified time` is not the file's last-commit date. Advisory only.
 * @param {string} headerText - Existing header content.
 * @param {{ gitCreated?: {date: string, timestamp: number} | null, gitLastModified?: {date: string, timestamp: number} | null }} [git={}] - Git history dates for the file.
 * @returns {DateCheckIssue[]} Issues found, in field order.
 */
export function checkHeaderDates(headerText, git = {}) {
	/** @type {DateCheckIssue[]} */
	const issues = [];

	for (const { field, prefix, gitKey, gitLabel, advisory } of DATE_FIELDS) {
		const value = readHeaderField(headerText, field);
		if (value === null) {
			continue;
		}

		const pair = value.match(/^(.+?)\s*\((\d+)\)$/);
		const parsed = pair ? parseHeaderDate(pair[1]) : null;
		if (!pair || !parsed) {
			issues.push({
				check: `${prefix}-format`,
				field,
				advisory: false,
				value,
				message: `${field} value "${value}" is not a "<datetime> (<epoch>)" pair with a recognised datetime`
			});
			continue;
		}

		const epoch = Number.parseInt(pair[2], 10);
		if (epoch !== parsed.timestamp) {
			issues.push({
				check: `${prefix}-epoch`,
				field,
				advisory: false,
				value,
				expected: `${pair[1]} (${parsed.timestamp})`,
				message: `${field} epoch ${epoch} does not match ${pair[1]} (expected ${parsed.timestamp})`
			});
		}

		const gitDate = git[gitKey];
		if (gitDate && gitDate.timestamp !== parsed.timestamp) {
			issues.push({
				check: `${prefix}-git`,
				field,
				advisory,
				value,
				expected: `${gitDate.date} (${gitDate.timestamp})`,
				message: `${field} ${pair[1]} does not match the ${gitLabel} ${gitDate.date} (${gitDate.timestamp})`
			});
		}
	}

	return issues;
}

/**
 * Repairs a header date payload whose epoch disagrees with its datetime text. The text is kept
 * as written and the epoch is recomputed from it. Unrecognised text is returned unchanged,
 * since there is no instant to recompute from.
 * @param {{date: string, timestamp: number} | null} payload - Date payload read from a header.
 * @returns {{date: string, timestamp: number} | null} Consistent payload, or null when none was given.
 */
export function repairDateEpoch(payload) {
	if (!payload) {
		return null;
	}

	const parsed = parseHeaderDate(payload.date);
	return parsed && parsed.timestamp !== payload.timestamp ? { date: payload.date, timestamp: parsed.timestamp } : payload;
}

/**
 * Rewrites a date payload's text in the git `%aI` form (`YYYY-MM-DDTHH:mm:ss±HH:MM`), keeping
 * its offset and instant. Unrecognised text is returned unchanged.
 * @param {{date: string, timestamp: number}} payload - Date payload.
 * @returns {{date: string, timestamp: number}} Payload with ISO 8601 text.
 */
export function normalizeDatePayload(payload) {
	const parsed = parseHeaderDate(payload.date);
	return parsed ? { date: formatIsoDate(parsed), timestamp: parsed.timestamp } : payload;
}
