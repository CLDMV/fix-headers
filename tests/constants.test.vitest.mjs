import { describe, expect, it } from "vitest";
import { DEFAULT_COMPANY_NAME, DEFAULT_IGNORE_FOLDERS, DEFAULT_MAX_HEADER_SCAN_LINES, DETECTOR_PROFILES } from "../src/constants.mjs";

describe("constants", () => {
	it("exports expected defaults", () => {
		expect(DEFAULT_COMPANY_NAME).toBe("Catalyzed Motivation Inc.");
		expect(DEFAULT_MAX_HEADER_SCAN_LINES).toBe(40);
		expect(DEFAULT_IGNORE_FOLDERS.has("node_modules")).toBe(true);
		expect(DETECTOR_PROFILES.some((profile) => profile.id === "node")).toBe(true);
	});
});
