/**
 *
 *	@Project: @cldmv/fix-headers
 *	@Filename: /src/utils/text.mjs
 *	@Date: 2026-10-31T16:30:00-07:00 (1793489400)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-31T16:30:00-07:00 (1793489400)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */
/**
 * @fileoverview String checks written as index scans instead of regular expressions, so they
 * run in linear time on any input (the regex forms backtrack polynomially on long runs of
 * `<` or `/`).
 * @module fix-headers/utils/text
 */
/**
 * Tells whether text contains a `<…>` tag with at least one character inside, the same test
 * as `/<[^>]+>/`.
 * @param {string} text - Text to check.
 * @returns {boolean} Whether a non-empty `<…>` tag is present.
 */
export function hasAngleTag(text: string): boolean;
/**
 * Removes every trailing `/`, the same as `.replace(/\/+$/, "")`.
 * @param {string} text - Text to trim.
 * @returns {string} The text without trailing slashes.
 */
export function trimTrailingSlashes(text: string): string;
