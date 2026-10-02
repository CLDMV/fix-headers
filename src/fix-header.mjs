/**
 *
 *	@Project: @cldmv/fix-headers
 *	@Filename: /src/fix-header.mjs
 *	@Date: 2026-03-01T13:34:00-08:00 (1772400840)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-02T12:28:16-07:00 (1790969296)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

import { fixHeaders as fixHeadersCore } from "./core/fix-headers.mjs";

/**
 * @fileoverview Public module API exposing a single function for header updates.
 * @module fix-headers
 */

/**
 * Runs header fix-up using automatic metadata detection and optional overrides.
 * @param {Parameters<typeof fixHeadersCore>[0]} [options] - Runtime options.
 * @returns {ReturnType<typeof fixHeadersCore>} Update report.
 */
export function fixHeaders(options) {
	return fixHeadersCore(options);
}

export default fixHeaders;
