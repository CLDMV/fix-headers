/**
 *
 *	@Project: @cldmv/fix-headers
 *	@Filename: /tests/non-js-formats.test.vitest.mjs
 *	@Date: 2026-10-03T17:03:42-07:00 (1791072222)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-03T17:08:31-07:00 (1791072511)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

import { join } from "node:path";
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { parseCliArgs, runCli } from "../src/cli.mjs";
import { fixHeaders } from "../src/core/fix-headers.mjs";
import { detector as markdownDetector } from "../src/detectors/markdown.mjs";
import {
	DETECTOR_PROFILES,
	getAllowedExtensions,
	getEnabledDetectors,
	getHeaderSkipReason,
	resolveForcedDetectors
} from "../src/detectors/index.mjs";
import { cleanupWorkspace, createWorkspace, writeWorkspaceFile } from "./helpers/workspace.mjs";

/**
 * @fileoverview Files whose format cannot carry the header's comment are never given one:
 * strict JSON never, Markdown only when the `markdown` detector is forced (then as an HTML
 * comment). Covers #120 and #122.
 */

const IDENTITY = {
	authorName: "Format Tester",
	authorEmail: "format@example.com",
	companyName: "Catalyzed Motivation Inc."
};

const PACKAGE_JSON = `${JSON.stringify({ name: "non-js-formats", version: "1.0.0" }, null, 2)}\n`;
const MARKDOWN = "# Title\n\nSome text.\n";

/**
 * Creates a workspace holding a package.json, a Markdown file, a JSON file and one JS file.
 * @param {string} name - Workspace name.
 * @returns {Promise<string>} Workspace path.
 */
async function createFormatsWorkspace(name) {
	const workspace = await createWorkspace(name);
	await writeWorkspaceFile(join(workspace, "package.json"), PACKAGE_JSON);
	await writeWorkspaceFile(join(workspace, "doc.md"), MARKDOWN);
	await writeWorkspaceFile(join(workspace, "docs", "notes.markdown"), MARKDOWN);
	await writeWorkspaceFile(join(workspace, "data", "config.json"), '{ "a": 1 }\n');
	await writeWorkspaceFile(join(workspace, "src", "one.mjs"), "export const one = true;\n");
	return workspace;
}

/**
 * Collects CLI output lines.
 * @returns {{ lines: string[], stdout: (message: string) => void }} Collector.
 */
function collect() {
	const lines = [];
	return { lines, stdout: (message) => lines.push(message) };
}

describe("formats that cannot carry the header comment", () => {
	it("a repo-wide run leaves Markdown and JSON untouched", async () => {
		const workspace = await createFormatsWorkspace("formats-repo-wide");
		try {
			const result = await fixHeaders({ cwd: workspace, ...IDENTITY });

			expect(result.changes.map((change) => change.file)).toEqual([join("src", "one.mjs")]);
			expect(result.filesSkipped).toBe(0);
			expect(result.skipped).toEqual([]);
			expect(await readFile(join(workspace, "package.json"), "utf8")).toBe(PACKAGE_JSON);
			expect(await readFile(join(workspace, "doc.md"), "utf8")).toBe(MARKDOWN);
			expect(await readFile(join(workspace, "docs", "notes.markdown"), "utf8")).toBe(MARKDOWN);
			expect(await readFile(join(workspace, "data", "config.json"), "utf8")).toBe('{ "a": 1 }\n');
			expect(await readFile(join(workspace, "src", "one.mjs"), "utf8")).toMatch(/^\/\*\*\n/);
		} finally {
			await cleanupWorkspace(workspace);
		}
	});

	it("skips a Markdown file named by input unless the markdown detector is forced", async () => {
		const workspace = await createFormatsWorkspace("formats-md-input");
		try {
			const result = await fixHeaders({ cwd: workspace, ...IDENTITY, input: "doc.md" });

			expect(result.filesScanned).toBe(0);
			expect(result.filesUpdated).toBe(0);
			expect(result.filesSkipped).toBe(1);
			expect(result.changes).toEqual([]);
			expect(result.skipped).toHaveLength(1);
			expect(result.skipped[0].file).toBe("doc.md");
			expect(result.skipped[0].reason).toMatch(/forcedDetectors: \["markdown"\]/);
			expect(await readFile(join(workspace, "doc.md"), "utf8")).toBe(MARKDOWN);
		} finally {
			await cleanupWorkspace(workspace);
		}
	});

	it("never writes a comment into package.json or any other .json file", async () => {
		const workspace = await createFormatsWorkspace("formats-json-input");
		try {
			for (const input of ["package.json", "data/config.json"]) {
				const result = await fixHeaders({ cwd: workspace, ...IDENTITY, input, forcedDetectors: ["markdown"] });
				expect(result.filesUpdated).toBe(0);
				expect(result.filesSkipped).toBe(1);
				expect(result.skipped[0].reason).toMatch(/no enabled detector handles \.json files/);
			}

			const directory = await fixHeaders({ cwd: workspace, ...IDENTITY, input: "data", includeExtensions: [".json"] });
			expect(directory.filesUpdated).toBe(0);
			expect(directory.skipped.map((entry) => entry.file)).toEqual([join("data", "config.json")]);

			const packageJson = await readFile(join(workspace, "package.json"), "utf8");
			expect(packageJson).toBe(PACKAGE_JSON);
			expect(JSON.parse(packageJson).name).toBe("non-js-formats");
			expect(JSON.parse(await readFile(join(workspace, "data", "config.json"), "utf8"))).toEqual({ a: 1 });
		} finally {
			await cleanupWorkspace(workspace);
		}
	});

	it("skips files with no extension, unknown extensions and disabled detectors' extensions", async () => {
		const workspace = await createFormatsWorkspace("formats-unknown");
		try {
			await writeWorkspaceFile(join(workspace, "bin", "tool"), "#!/usr/bin/env node\nconsole.log(1);\n");
			await writeWorkspaceFile(join(workspace, "notes.txt"), "hello\n");
			await writeWorkspaceFile(join(workspace, "ci.yml"), "name: ci\n");

			const extensionless = await fixHeaders({ cwd: workspace, ...IDENTITY, input: "bin/tool" });
			expect(extensionless.skipped[0].reason).toMatch(/no extension/);

			const unknown = await fixHeaders({ cwd: workspace, ...IDENTITY, input: "notes.txt" });
			expect(unknown.skipped[0].reason).toMatch(/no enabled detector handles \.txt files/);

			const disabled = await fixHeaders({ cwd: workspace, ...IDENTITY, input: "ci.yml", disabledDetectors: ["yaml"] });
			expect(disabled.skipped[0].reason).toMatch(/no enabled detector handles \.yml files/);

			expect(await readFile(join(workspace, "bin", "tool"), "utf8")).toBe("#!/usr/bin/env node\nconsole.log(1);\n");
			expect(await readFile(join(workspace, "notes.txt"), "utf8")).toBe("hello\n");
			expect(await readFile(join(workspace, "ci.yml"), "utf8")).toBe("name: ci\n");
		} finally {
			await cleanupWorkspace(workspace);
		}
	});

	it("writes an HTML-comment header into forced Markdown and updates it in place on re-runs", async () => {
		const workspace = await createFormatsWorkspace("formats-md-forced");
		try {
			const first = await fixHeaders({ cwd: workspace, ...IDENTITY, input: "doc.md", forcedDetectors: ["markdown"] });
			expect(first.filesUpdated).toBe(1);
			expect(first.filesSkipped).toBe(0);

			const written = await readFile(join(workspace, "doc.md"), "utf8");
			expect(written).toMatch(/^<!--\n\n\t@Project: non-js-formats\n/);
			expect(written).toMatch(/\n-->\n\n\n# Title\n\nSome text\.\n$/);
			expect(written).not.toContain("/**");

			const second = await fixHeaders({ cwd: workspace, ...IDENTITY, input: "doc.md", forcedDetectors: ["markdown"] });
			expect(second.filesUpdated).toBe(0);
			expect(await readFile(join(workspace, "doc.md"), "utf8")).toBe(written);

			const renamed = await fixHeaders({
				cwd: workspace,
				...IDENTITY,
				input: "doc.md",
				forcedDetectors: ["markdown"],
				projectName: "renamed-project"
			});
			expect(renamed.filesUpdated).toBe(1);
			const rewritten = await readFile(join(workspace, "doc.md"), "utf8");
			expect(rewritten.match(/<!--/g)).toHaveLength(1);
			expect(rewritten.match(/@Project:/g)).toHaveLength(1);
			expect(rewritten).toContain("@Project: renamed-project");
			expect(rewritten).toMatch(/\n-->\n\n\n# Title\n/);
		} finally {
			await cleanupWorkspace(workspace);
		}
	});

	it("keeps Markdown front matter above a forced header", async () => {
		const workspace = await createWorkspace("formats-md-front-matter");
		try {
			await writeWorkspaceFile(join(workspace, "package.json"), PACKAGE_JSON);
			await writeWorkspaceFile(join(workspace, "page.md"), "---\ntitle: Page\n---\n# Page\n");

			await fixHeaders({ cwd: workspace, ...IDENTITY, input: "page.md", forcedDetectors: ["markdown"] });
			const once = await readFile(join(workspace, "page.md"), "utf8");
			expect(once).toMatch(/^---\ntitle: Page\n---\n<!--\n/);
			expect(once).toMatch(/\n-->\n\n\n# Page\n$/);

			await fixHeaders({ cwd: workspace, ...IDENTITY, input: "page.md", forcedDetectors: ["markdown"] });
			expect(await readFile(join(workspace, "page.md"), "utf8")).toBe(once);
		} finally {
			await cleanupWorkspace(workspace);
		}
	});

	it("includes Markdown in discovery once forced, and a disabled detector stays off even when forced", async () => {
		const workspace = await createFormatsWorkspace("formats-md-discovery");
		try {
			const forced = await fixHeaders({ cwd: workspace, ...IDENTITY, dryRun: true, forcedDetectors: ["markdown"] });
			expect(forced.changes.map((change) => change.file).sort()).toEqual(
				["doc.md", join("docs", "notes.markdown"), join("src", "one.mjs")].sort()
			);

			const disabled = await fixHeaders({
				cwd: workspace,
				...IDENTITY,
				input: "doc.md",
				forcedDetectors: ["markdown"],
				disabledDetectors: ["markdown"]
			});
			expect(disabled.filesSkipped).toBe(1);
			expect(disabled.skipped[0].reason).toMatch(/no enabled detector handles \.md files/);
			expect(await readFile(join(workspace, "doc.md"), "utf8")).toBe(MARKDOWN);
		} finally {
			await cleanupWorkspace(workspace);
		}
	});

	it("rejects forcedDetectors values that are not force-only detectors", async () => {
		expect(resolveForcedDetectors(undefined)).toEqual([]);
		expect(resolveForcedDetectors(null)).toEqual([]);
		expect(resolveForcedDetectors(["markdown", "markdown"])).toEqual(["markdown"]);
		expect(() => resolveForcedDetectors("markdown")).toThrow(/forcedDetectors must be an array of detector ids/);
		expect(() => resolveForcedDetectors([1])).toThrow(/forcedDetectors must be an array of detector ids/);
		expect(() => resolveForcedDetectors(["md"])).toThrow(/unknown detector "md"/);
		expect(() => resolveForcedDetectors(["node"])).toThrow(/"node" does not need forcing/);
		await expect(fixHeaders({ cwd: process.cwd(), forcedDetectors: ["json"], dryRun: true })).rejects.toThrow(
			/"json" does not need forcing/
		);
	});
});

describe("markdown detector and force-only registry helpers", () => {
	it("resolves an HTML comment for .md and .markdown only", () => {
		expect(markdownDetector.requiresForce).toBe(true);
		expect(markdownDetector.enabledByDefault).toBe(false);
		expect(markdownDetector.resolveCommentSyntax("/repo/README.md")).toEqual({
			kind: "html",
			blockStart: "<!--",
			blockLinePrefix: "\t",
			blockEnd: "-->"
		});
		expect(markdownDetector.resolveCommentSyntax("/repo/notes.MARKDOWN")?.kind).toBe("html");
		expect(markdownDetector.resolveCommentSyntax("/repo/page.mdx")).toBeNull();
	});

	it("preserves YAML front matter only when it is closed", () => {
		expect(markdownDetector.resolvePreservedPrefix("a.md", "---\ntitle: x\n---\n# A\n")).toBe("---\ntitle: x\n---\n");
		expect(markdownDetector.resolvePreservedPrefix("a.md", "---\r\ntitle: x\r\n---\r\nbody")).toBe("---\r\ntitle: x\r\n---\r\n");
		expect(markdownDetector.resolvePreservedPrefix("a.md", "---\ntitle: x\n---")).toBe("---\ntitle: x\n---");
		expect(markdownDetector.resolvePreservedPrefix("a.md", "---\nnot closed\n")).toBe("");
		expect(markdownDetector.resolvePreservedPrefix("a.md", "# A\n---\n")).toBe("");
	});

	it("keeps force-only detectors out of the enabled set and extensions until forced", () => {
		const defaults = getEnabledDetectors();
		expect(defaults.map((detector) => detector.id)).not.toContain("markdown");
		expect(defaults).toHaveLength(DETECTOR_PROFILES.filter((detector) => detector.requiresForce !== true).length);
		expect(getEnabledDetectors({ enabledDetectors: ["markdown"] }).map((detector) => detector.id)).toEqual([]);
		expect(getEnabledDetectors({ enabledDetectors: ["node"], forcedDetectors: ["markdown"] }).map((detector) => detector.id)).toEqual([
			"markdown",
			"node"
		]);
		expect(getAllowedExtensions().has(".md")).toBe(false);
		expect(getAllowedExtensions({ forcedDetectors: ["markdown"] }).has(".md")).toBe(true);
	});

	it("explains why a file gets no header", () => {
		expect(getHeaderSkipReason("/repo/a.mjs")).toBeNull();
		expect(getHeaderSkipReason("/repo/a.md", { forcedDetectors: ["markdown"] })).toBeNull();
		expect(getHeaderSkipReason("/repo/a.md")).toMatch(/--force-detector markdown/);
		expect(getHeaderSkipReason("/repo/package.json")).toMatch(/no enabled detector handles \.json files/);
		expect(getHeaderSkipReason("/repo/Makefile")).toMatch(/no extension/);
	});
});

describe("cli: formats that cannot carry the header comment", () => {
	it("parses --force-detector as a repeatable, de-duplicated list", () => {
		const parsed = parseCliArgs(["--force-detector", "markdown", "--force-detector", "markdown"]);
		expect(parsed.options.forcedDetectors).toEqual(["markdown"]);
	});

	it("reports a Markdown or JSON file named by --input as skipped and leaves it byte-identical", async () => {
		const workspace = await createFormatsWorkspace("formats-cli-skip");
		try {
			for (const input of ["doc.md", "package.json"]) {
				const { lines, stdout } = collect();
				const code = await runCli(["--cwd", workspace, "--input", input, "--author-name", "A", "--author-email", "a@example.com"], {
					stdout
				});
				expect(code).toBe(0);
				expect(lines[0]).toBe("fix-headers complete: scanned=0, updated=0, skipped=1, dryRun=false");
				expect(lines[1]).toMatch(new RegExp(`^skipped: ${input.replace(".", "\\.")} \\(`));
				expect(lines.some((line) => line.startsWith("updated:"))).toBe(false);
			}
			expect(await readFile(join(workspace, "doc.md"), "utf8")).toBe(MARKDOWN);
			expect(await readFile(join(workspace, "package.json"), "utf8")).toBe(PACKAGE_JSON);
		} finally {
			await cleanupWorkspace(workspace);
		}
	});

	it("prints placeholders for skipped entries a custom runner leaves incomplete", async () => {
		const { lines, stdout } = collect();
		const runner = async () => ({ filesScanned: 0, filesUpdated: 0, filesSkipped: 2, skipped: [null, {}], dryRun: true });
		expect(await runCli([], { runner, stdout })).toBe(0);
		expect(lines).toEqual([
			"fix-headers complete: scanned=0, updated=0, skipped=2, dryRun=true",
			"skipped: <unknown-file> (no reason given)",
			"skipped: <unknown-file> (no reason given)"
		]);
	});

	it("writes an HTML comment into Markdown with --force-detector markdown", async () => {
		const workspace = await createFormatsWorkspace("formats-cli-forced");
		try {
			const args = [
				"--cwd",
				workspace,
				"--input",
				"doc.md",
				"--force-detector",
				"markdown",
				"--author-name",
				"A",
				"--author-email",
				"a@x.dev"
			];
			const first = collect();
			expect(await runCli([...args, "--verbose"], { stdout: first.stdout })).toBe(0);
			expect(first.lines).toEqual(["fix-headers complete: scanned=1, updated=1, dryRun=false", "updated: doc.md"]);

			const written = await readFile(join(workspace, "doc.md"), "utf8");
			expect(written.startsWith("<!--\n")).toBe(true);

			expect(await runCli(args, { stdout: () => {} })).toBe(0);
			expect(await readFile(join(workspace, "doc.md"), "utf8")).toBe(written);
		} finally {
			await cleanupWorkspace(workspace);
		}
	});
});
