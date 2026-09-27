/**
 *	@Project: @cldmv/fix-headers
 *	@Filename: /src/index.cjs.mjs
 *	@Date: 2026-09-27 11:47:59 -07:00 (1790534879)
 *	@Author: Shinrai
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Shinrai (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-09-27 11:50:38 -07:00 (1790535038)
 *	-----
 *	@Copyright: Copyright (c) 2026-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview CommonJS entry point. Exposes only the default export so the
 * CommonJS build keeps the historical `module.exports = fixHeaders` shape
 * (`require("@cldmv/fix-headers")` returns the function itself).
 * @module fix-headers/cjs-entry
 */

import { fixHeaders } from "./fix-header.mjs";

export default fixHeaders;
