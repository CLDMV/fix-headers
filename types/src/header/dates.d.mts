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
export type DateCheckIssue = {
    check: "created-format" | "created-epoch" | "created-git" | "modified-format" | "modified-epoch" | "modified-git";
    field: "@Date" | "@Last modified time";
    advisory: boolean;
    value: string;
    expected?: string;
    message: string;
};
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
export declare function checkHeaderDates(headerText: string, git?: {
    gitCreated?: {
        date: string;
        timestamp: number;
    } | null;
    gitLastModified?: {
        date: string;
        timestamp: number;
    } | null;
}): DateCheckIssue[];
/**
 * Repairs a header date payload whose epoch disagrees with its datetime text. The text is kept
 * as written and the epoch is recomputed from it. Unrecognised text is returned unchanged,
 * since there is no instant to recompute from.
 * @param {{date: string, timestamp: number} | null} payload - Date payload read from a header.
 * @returns {{date: string, timestamp: number} | null} Consistent payload, or null when none was given.
 */
export declare function repairDateEpoch(payload: {
    date: string;
    timestamp: number;
} | null): {
    date: string;
    timestamp: number;
} | null;
/**
 * Rewrites a date payload's text in the git `%aI` form (`YYYY-MM-DDTHH:mm:ss±HH:MM`), keeping
 * its offset and instant. Unrecognised text is returned unchanged.
 * @param {{date: string, timestamp: number}} payload - Date payload.
 * @returns {{date: string, timestamp: number}} Payload with ISO 8601 text.
 */
export declare function normalizeDatePayload(payload: {
    date: string;
    timestamp: number;
}): {
    date: string;
    timestamp: number;
};
