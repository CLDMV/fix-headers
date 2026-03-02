import { describe, expect, it } from "vitest";
import { formatDateWithTimezone, toDatePayload } from "../src/utils/time.mjs";

describe("utils/time", () => {
	it("formats date with timezone offset", () => {
		const date = new Date("2026-03-01T21:30:00.000Z");
		const formatted = formatDateWithTimezone(date);
		expect(formatted).toMatch(/^2026-03-01\s\d{2}:\d{2}:\d{2}\s[+-]\d{2}:\d{2}$/);
	});

	it("formats timezone with explicit plus and minus signs", () => {
		const makeDate = (timezoneOffsetMinutes) =>
			/** @type {Date} */ ({
				getTimezoneOffset() {
					return timezoneOffsetMinutes;
				},
				getFullYear() {
					return 2026;
				},
				getMonth() {
					return 0;
				},
				getDate() {
					return 1;
				},
				getHours() {
					return 2;
				},
				getMinutes() {
					return 3;
				},
				getSeconds() {
					return 4;
				}
			});

		const plus = formatDateWithTimezone(makeDate(-120));
		const minus = formatDateWithTimezone(makeDate(120));

		expect(plus).toContain("+02:00");
		expect(minus).toContain("-02:00");
	});

	it("returns date payload with unix timestamp", () => {
		const date = new Date("2026-01-01T00:00:05.000Z");
		const payload = toDatePayload(date);
		expect(payload.timestamp).toBe(1767225605);
		expect(payload.date).toMatch(/^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2}\s[+-]\d{2}:\d{2}$/);
	});
});
