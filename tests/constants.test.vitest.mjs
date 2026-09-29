/**
 *	@Project: @cldmv/fix-headers
 *	@Filename: /tests/constants.test.vitest.mjs
 *	@Date: 2026-03-01T17:59:32-08:00 (1772416772)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-01T17:59:32-08:00 (1772416772)
 *	-----
 *	@Copyright: Copyright (c) 2026-2026 Catalyzed Motivation Inc. All rights reserved.
 */

import { describe, expect, it } from "vitest";
import * as constants from "../src/constants.mjs";
import { DEFAULT_COMPANY_NAME, DEFAULT_MAX_HEADER_SCAN_LINES, DETECTOR_PROFILES } from "../src/constants.mjs";

describe("constants", () => {
	it("exports expected defaults", () => {
		expect(DEFAULT_COMPANY_NAME).toBe("Catalyzed Motivation Inc.");
		expect(DEFAULT_MAX_HEADER_SCAN_LINES).toBe(200);
		expect(DETECTOR_PROFILES.some((profile) => profile.id === "node")).toBe(true);
		expect(DETECTOR_PROFILES.some((profile) => profile.id === "json")).toBe(true);
	});

	it("exports no hard-coded ignore folders: ignore files decide what discovery skips (issue #71)", () => {
		expect(Object.keys(constants).filter((name) => name.includes("IGNORE"))).toEqual([]);
	});
});
