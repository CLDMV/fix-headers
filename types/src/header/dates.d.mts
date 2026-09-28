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
export type DatePayload = {
    date: string;
    timestamp: number;
};
export type CreatedDateSource = "existing-header" | "git-created" | "filesystem-created";
export type DateCheckIssue = {
    check: "created-format" | "created-epoch" | "created-newer-than-source" | "modified-format" | "modified-epoch" | "modified-git";
    field: "@Date" | "@Last modified time";
    advisory: boolean;
    value: string;
    expected?: string;
    source?: "git-created" | "filesystem-created";
    message: string;
};
/**
 * Picks the earliest of several labelled date payloads. Missing payloads are skipped and the
 * earlier entry wins a tie, so callers list their preferred source first.
 * @template {string} S
 * @param {Array<{source: S, payload: DatePayload | null | undefined}>} candidates - Labelled payloads.
 * @returns {{source: S, payload: DatePayload} | null} Earliest candidate, or null when none has a payload.
 */
export declare function pickOldestDate<S extends string>(candidates: Array<{
    source: S;
    payload: DatePayload | null | undefined;
}>): {
    source: S;
    payload: DatePayload;
} | null;
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
export declare function resolveCreatedDate({ existing, gitCreated, filesystemCreated, fixCreatedDate }: {
    existing: DatePayload | null;
    gitCreated: DatePayload | null;
    filesystemCreated: DatePayload;
    fixCreatedDate?: boolean;
}): {
    source: CreatedDateSource;
    payload: DatePayload;
};
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
export declare function checkHeaderDates(headerText: string, sources?: {
    gitCreated?: DatePayload | null;
    gitLastModified?: DatePayload | null;
    filesystemCreated?: DatePayload | null;
}, options?: {
    strictCreatedDate?: boolean;
}): DateCheckIssue[];
/**
 * Repairs a header date payload whose epoch disagrees with its datetime text. The text is kept
 * as written and the epoch is recomputed from it. Unrecognised text is returned unchanged,
 * since there is no instant to recompute from.
 * @param {DatePayload | null} payload - Date payload read from a header.
 * @returns {DatePayload | null} Consistent payload, or null when none was given.
 */
export declare function repairDateEpoch(payload: DatePayload | null): DatePayload | null;
/**
 * Rewrites a date payload's text in the git `%aI` form (`YYYY-MM-DDTHH:mm:ss±HH:MM`), keeping
 * its offset and instant. Unrecognised text is returned unchanged.
 * @param {DatePayload} payload - Date payload.
 * @returns {DatePayload} Payload with ISO 8601 text.
 */
export declare function normalizeDatePayload(payload: DatePayload): DatePayload;
