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

import { formatIsoDate, formatSpaceDate, parseHeaderDate, toZonedDateParts } from "../utils/time.mjs";

/**
 * @fileoverview Header date validation, creation-date resolution ("oldest wins"), and date repair/normalization.
 * @module fix-headers/header/dates
 */

/**
 * @typedef {{date: string, timestamp: number}} DatePayload
 */

/**
 * @typedef {"existing-header" | "git-created" | "filesystem-created"} CreatedDateSource
 */

/**
 * @typedef {{
 *  check: "created-format" | "created-epoch" | "created-newer-than-source" | "modified-format" | "modified-epoch" | "modified-git",
 *  field: "@Date" | "@Last modified time",
 *  advisory: boolean,
 *  value: string,
 *  expected?: string,
 *  source?: "git-created" | "filesystem-created",
 *  message: string
 * }} DateCheckIssue
 */

/**
 * Human-readable label for each creation-date source.
 * @type {Record<"git-created" | "filesystem-created", string>}
 */
const SOURCE_LABELS = {
	"git-created": "git first commit",
	"filesystem-created": "filesystem creation time"
};

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
 * Picks the earliest of several labelled date payloads. Missing payloads are skipped and the
 * earlier entry wins a tie, so callers list their preferred source first.
 * @template {string} S
 * @param {Array<{source: S, payload: DatePayload | null | undefined}>} candidates - Labelled payloads.
 * @returns {{source: S, payload: DatePayload} | null} Earliest candidate, or null when none has a payload.
 */
export function pickOldestDate(candidates) {
	/** @type {{source: S, payload: DatePayload} | null} */
	let oldest = null;
	for (const { source, payload } of candidates) {
		if (payload && (!oldest || payload.timestamp < oldest.payload.timestamp)) {
			oldest = { source, payload };
		}
	}
	return oldest;
}

/**
 * Resolves the `@Date` to write ("oldest wins").
 * - No usable existing `@Date` (no header, or no `(epoch)`): the older of the git first-commit
 *   date and the filesystem creation time (git on a tie).
 * - Existing `@Date`, default: kept as written (epoch repaired separately by {@link repairDateEpoch}).
 * - Existing `@Date` with `fixCreatedDate`: the oldest of the existing date (when its datetime is
 *   recognised), the git first commit, and the filesystem creation time. The existing date wins a
 *   tie, so a correction only ever moves `@Date` earlier.
 * @param {{ existing: DatePayload | null, gitCreated: DatePayload | null, filesystemCreated: DatePayload, fixCreatedDate?: boolean }} input - Candidate dates.
 * @returns {{source: CreatedDateSource, payload: DatePayload}} Chosen date and where it came from.
 */
export function resolveCreatedDate({ existing, gitCreated, filesystemCreated, fixCreatedDate = false }) {
	/** @type {Array<{source: CreatedDateSource, payload: DatePayload | null}>} */
	const sources = [
		{ source: "git-created", payload: gitCreated },
		{ source: "filesystem-created", payload: filesystemCreated }
	];
	if (!existing) {
		return /** @type {{source: CreatedDateSource, payload: DatePayload}} */ (pickOldestDate(sources));
	}
	if (!fixCreatedDate) {
		return { source: "existing-header", payload: existing };
	}

	const recognised = parseHeaderDate(existing.date) ? existing : null;
	return /** @type {{source: CreatedDateSource, payload: DatePayload}} */ (
		pickOldestDate([{ source: "existing-header", payload: recognised }, ...sources])
	);
}

/**
 * Reads the calendar year of a header date, for the `@Copyright` start year. With a time zone the
 * year is the zone's at the date's instant; without one it is the year the datetime text is
 * written in, in its own offset. Text that is not a recognised datetime falls back to the year of
 * its epoch in the local time zone, the zone fix-headers writes dates in by default.
 * @param {DatePayload} payload - Date payload, with an epoch consistent with its text.
 * @param {string | null} [timeZone=null] - IANA zone name, already validated.
 * @returns {number} Calendar year.
 */
export function dateYear(payload, timeZone = null) {
	if (timeZone) {
		return toZonedDateParts(payload.timestamp, timeZone).year;
	}

	const parsed = parseHeaderDate(payload.date);
	return parsed ? parsed.year : new Date(payload.timestamp * 1000).getFullYear();
}

/**
 * Checks one date field's value: it must be a `<datetime> (<epoch>)` pair whose epoch is the
 * instant the datetime describes.
 * @param {string} value - Raw field value.
 * @param {"@Date" | "@Last modified time"} field - Field label.
 * @param {"created" | "modified"} prefix - Check id prefix.
 * @param {DateCheckIssue[]} issues - Issue list to append to.
 * @returns {{text: string, timestamp: number} | null} The datetime text and its instant, or null when unrecognised.
 */
function checkDateValue(value, field, prefix, issues) {
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
		return null;
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
	return { text: pair[1], timestamp: parsed.timestamp };
}

/**
 * Validates the `@Date` and `@Last modified time` values of an existing header.
 *
 * Every comparison is between instants, so the same moment written with another offset or in
 * the space/`T` form is not drift. The checks are independent of the rendered-header diff, so
 * an author, identity, or other content difference never produces an issue here.
 * - `*-format`: the value is not a recognised `<datetime> (<epoch>)` pair.
 * - `*-epoch`: the parenthesised epoch is not the instant the datetime text describes.
 * - `created-newer-than-source`: `@Date` is later than the older of the git first commit and the
 *   filesystem creation time. An earlier `@Date` is fine. Advisory unless `strictCreatedDate`.
 * - `modified-git`: `@Last modified time` is not the file's last-commit date. Always advisory.
 * @param {string} headerText - Existing header content.
 * @param {{ gitCreated?: DatePayload | null, gitLastModified?: DatePayload | null, filesystemCreated?: DatePayload | null }} [sources={}] - Dates the header is compared against.
 * @param {{ strictCreatedDate?: boolean }} [options={}] - Check options.
 * @returns {DateCheckIssue[]} Issues found, `@Date` first.
 */
export function checkHeaderDates(headerText, sources = {}, options = {}) {
	/** @type {DateCheckIssue[]} */
	const issues = [];

	const createdValue = readHeaderField(headerText, "@Date");
	const created = createdValue === null ? null : checkDateValue(createdValue, "@Date", "created", issues);
	const oldestSource = pickOldestDate([
		{ source: /** @type {const} */ ("git-created"), payload: sources.gitCreated },
		{ source: /** @type {const} */ ("filesystem-created"), payload: sources.filesystemCreated }
	]);
	if (created && oldestSource && created.timestamp > oldestSource.payload.timestamp) {
		const label = SOURCE_LABELS[oldestSource.source];
		issues.push({
			check: "created-newer-than-source",
			field: "@Date",
			advisory: options.strictCreatedDate !== true,
			value: /** @type {string} */ (createdValue),
			expected: `${oldestSource.payload.date} (${oldestSource.payload.timestamp})`,
			source: oldestSource.source,
			message: `@Date ${created.text} is later than the ${label} ${oldestSource.payload.date} (${oldestSource.payload.timestamp})`
		});
	}

	const modifiedValue = readHeaderField(headerText, "@Last modified time");
	const modified = modifiedValue === null ? null : checkDateValue(modifiedValue, "@Last modified time", "modified", issues);
	const gitLastModified = sources.gitLastModified;
	if (modified && gitLastModified && modified.timestamp !== gitLastModified.timestamp) {
		issues.push({
			check: "modified-git",
			field: "@Last modified time",
			advisory: true,
			value: /** @type {string} */ (modifiedValue),
			expected: `${gitLastModified.date} (${gitLastModified.timestamp})`,
			message: `@Last modified time ${modified.text} does not match the git last commit ${gitLastModified.date} (${gitLastModified.timestamp})`
		});
	}

	return issues;
}

/**
 * Repairs a header date payload whose epoch disagrees with its datetime text. The text is kept
 * as written and the epoch is recomputed from it. Unrecognised text is returned unchanged,
 * since there is no instant to recompute from.
 * @param {DatePayload | null} payload - Date payload read from a header.
 * @returns {DatePayload | null} Consistent payload, or null when none was given.
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
 * @param {DatePayload} payload - Date payload.
 * @returns {DatePayload} Payload with ISO 8601 text.
 */
export function normalizeDatePayload(payload) {
	const parsed = parseHeaderDate(payload.date);
	return parsed ? { date: formatIsoDate(parsed), timestamp: parsed.timestamp } : payload;
}

/**
 * Rewrites a date payload's text in a time zone, keeping its instant: the wall-clock time and
 * offset become the zone's at that instant (DST included). The text keeps its shape: the T-form
 * stays in the T-form and anything else is written in the space form. The payload is returned
 * unchanged when its text is unrecognised (there is no instant to convert), when it is already
 * in the zone's offset at that instant, or when the zone's offset then is not a whole number of
 * minutes (historical local mean time), which a `±HH:MM` offset cannot express.
 * @param {DatePayload} payload - Date payload.
 * @param {string} timeZone - IANA zone name, already validated.
 * @returns {DatePayload} Payload expressed in the zone.
 */
export function convertDatePayload(payload, timeZone) {
	const parsed = parseHeaderDate(payload.date);
	if (!parsed) {
		return payload;
	}

	const zoned = toZonedDateParts(parsed.timestamp, timeZone);
	if (zoned.offsetMinutes === parsed.offsetMinutes || !Number.isInteger(zoned.offsetMinutes)) {
		return payload;
	}

	const isIsoForm = /^\d{4}-\d{2}-\d{2}T/i.test(payload.date.trim());
	return { date: isIsoForm ? formatIsoDate(zoned) : formatSpaceDate(zoned), timestamp: parsed.timestamp };
}
