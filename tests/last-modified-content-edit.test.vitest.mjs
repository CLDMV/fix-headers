/**
 *
 *	@Project: @cldmv/fix-headers
 *	@Filename: /tests/last-modified-content-edit.test.vitest.mjs
 *	@Date: 2026-10-03T22:49:12-07:00 (1791092952)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-03T22:50:31-07:00 (1791093031)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

import { execFile } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { fixHeaders } from "../src/core/fix-headers.mjs";
import { extractHeaderlessBody } from "../src/header/parser.mjs";
import { readGitHeadFile } from "../src/utils/git.mjs";
import { FIXTURE_ROOT, cleanupWorkspace, createWorkspace, writeWorkspaceFile } from "./helpers/workspace.mjs";

/**
 * @fileoverview `@Last modified by` follows edits to a file's content, not header rewrites,
 * and `@Author` is kept unless `forceAuthorUpdate` is set (CLDMV/fix-headers#127).
 *
 * Every fixture is a real git repository. The file is committed by "Original Author"; the run
 * that follows is made by "Jane Contributor", whose identity comes only from a temporary global
 * git config (`user.name`/`user.email`, no signing key), the way a contributor's own machine
 * supplies it. `useGpgSignerAuthor` is on, as in the shared CLDMV config: with no signing key
 * the run falls back to `user.name`.
 */

const execFileAsync = promisify(execFile);

const PROJECT = "lm-content-edit";
const COMPANY = "Fixture Co.";
const ORIGINAL = { name: "Original Author", email: "original@example.com" };
const JANE = { name: "Jane Contributor", email: "jane@example.com" };
const CREATED = "2026-03-01 17:59:32 -08:00 (1772416772)";
const MODIFIED = "2026-03-02 09:00:00 -08:00 (1772470800)";
const BODY = "export const one = true;\n";

/**
 * Renders a current header for `src/one.mjs` (as fix-headers writes it) followed by a body.
 * @param {{ body?: string, author?: {name: string, email: string}, editor?: {name: string, email: string}, created?: string, modified?: string }} [parts={}] - Header values and body.
 * @returns {string} File content.
 */
function fileWithHeader(parts = {}) {
	const { body = BODY, author = ORIGINAL, editor = ORIGINAL, created = CREATED, modified = MODIFIED } = parts;
	const year = new Date().getFullYear();
	return `/**\n *\n *\t@Project: ${PROJECT}\n *\t@Filename: /src/one.mjs\n *\t@Date: ${created}\n *\t@Author: ${author.name}\n *\t@Email: <${author.email}>\n *\t-----\n *\t@Last modified by: ${editor.name} (${editor.email})\n *\t@Last modified time: ${modified}\n *\t-----\n *\t@Copyright: Copyright (c) 2026-${year} ${COMPANY} All rights reserved.\n *\n */\n\n\n${body}`;
}

/**
 * Runs git in a workspace.
 * @param {string} cwd - Workspace path.
 * @param {string[]} args - Git arguments.
 * @returns {Promise<void>} Completion promise.
 */
async function git(cwd, args) {
	await execFileAsync("git", args, { cwd });
}

/**
 * Commits everything in the workspace as Original Author, leaving no identity in the repository config.
 * @param {string} cwd - Workspace path.
 * @param {string} message - Commit message.
 * @returns {Promise<void>} Completion promise.
 */
async function commitAsOriginal(cwd, message) {
	await git(cwd, ["add", "."]);
	await git(cwd, ["-c", `user.name=${ORIGINAL.name}`, "-c", `user.email=${ORIGINAL.email}`, "commit", "-q", "-m", message]);
}

/**
 * Creates a git workspace with a package.json and, when given, a committed `src/one.mjs`.
 * @param {string} name - Workspace name.
 * @param {string | null} committedContent - Content committed for `src/one.mjs`, or null for none.
 * @returns {Promise<string>} Workspace path.
 */
async function createRepo(name, committedContent) {
	const workspace = await createWorkspace(name);
	await writeWorkspaceFile(join(workspace, "package.json"), JSON.stringify({ name: PROJECT }, null, 2));
	if (committedContent !== null) {
		await writeWorkspaceFile(join(workspace, "src", "one.mjs"), committedContent);
	}
	await git(workspace, ["init", "-q"]);
	await commitAsOriginal(workspace, "initial");
	return workspace;
}

/**
 * Runs fix-headers on `src/one.mjs` as Jane (identity from the global git config).
 * @param {string} workspace - Workspace path.
 * @param {Record<string, unknown>} [options={}] - Extra options.
 * @returns {Promise<{ result: Awaited<ReturnType<typeof fixHeaders>>, content: string }>} Run result and the file afterwards.
 */
async function runAsJane(workspace, options = {}) {
	const result = await fixHeaders({
		cwd: workspace,
		input: "src/one.mjs",
		companyName: COMPANY,
		useGpgSignerAuthor: true,
		...options
	});
	return { result, content: await readFile(join(workspace, "src", "one.mjs"), "utf8") };
}

/**
 * Reads one header tag value.
 * @param {string} content - File content.
 * @param {string} label - Tag label.
 * @returns {string | undefined} The value.
 */
function tag(content, label) {
	return content.match(new RegExp(`@${label}:[ \\t]*(.*)$`, "m"))?.[1];
}

describe("@Last modified by follows content edits (#127)", () => {
	/** @type {string | undefined} */
	let previousGlobalConfig;
	/** @type {string} */
	let globalConfigWorkspace;

	beforeEach(async () => {
		previousGlobalConfig = process.env.GIT_CONFIG_GLOBAL;
		globalConfigWorkspace = await createWorkspace("lm-global-config");
		const globalConfig = join(globalConfigWorkspace, "gitconfig");
		await writeFile(globalConfig, `[user]\n\tname = ${JANE.name}\n\temail = ${JANE.email}\n`, "utf8");
		process.env.GIT_CONFIG_GLOBAL = globalConfig;
	});

	afterEach(async () => {
		process.env.GIT_CONFIG_GLOBAL = previousGlobalConfig;
		await cleanupWorkspace(globalConfigWorkspace);
	});

	it("leaves a current, unedited file untouched", async () => {
		const workspace = await createRepo("lm-no-change", fileWithHeader());
		try {
			const { result, content } = await runAsJane(workspace);
			expect(result.filesUpdated).toBe(0);
			expect(content).toBe(fileWithHeader());
		} finally {
			await cleanupWorkspace(workspace);
		}
	});

	it("restamps the time but keeps @Last modified by and @Author when only the date format changes", async () => {
		const workspace = await createRepo("lm-header-only", fileWithHeader());
		try {
			const { result, content } = await runAsJane(workspace, { normalizeDateFormat: true });
			expect(result.filesUpdated).toBe(1);
			expect(tag(content, "Date")).toBe("2026-03-01T17:59:32-08:00 (1772416772)");
			expect(tag(content, "Last modified time")).not.toBe(MODIFIED);
			expect(tag(content, "Last modified time")).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2} \(\d+\)$/);
			expect(tag(content, "Last modified by")).toBe(`${ORIGINAL.name} (${ORIGINAL.email})`);
			expect(tag(content, "Author")).toBe(ORIGINAL.name);
			expect(tag(content, "Email")).toBe(`<${ORIGINAL.email}>`);
			expect(content.endsWith(`\n\n\n${BODY}`)).toBe(true);
		} finally {
			await cleanupWorkspace(workspace);
		}
	});

	it("keeps @Last modified by for other header-only rewrites (stale fields, spacing, margin)", async () => {
		const stale = fileWithHeader()
			.replace(`@Project: ${PROJECT}`, "@Project: old-name")
			.replace("@Filename: /src/one.mjs", "@Filename: /src/old.mjs")
			.replace(" */\n\n\n", " */\n");
		const workspace = await createRepo("lm-header-fields", stale);
		try {
			const { result, content } = await runAsJane(workspace, { spacing: 2 });
			expect(result.filesUpdated).toBe(1);
			expect(tag(content, "Project")).toBe(PROJECT);
			expect(tag(content, "Filename")).toBe("/src/one.mjs");
			expect(tag(content, "Last modified time")).not.toBe(MODIFIED);
			expect(tag(content, "Last modified by")).toBe(`${ORIGINAL.name} (${ORIGINAL.email})`);
			expect(tag(content, "Author")).toBe(ORIGINAL.name);
		} finally {
			await cleanupWorkspace(workspace);
		}
	});

	it("stamps the runner as @Last modified by when the body was edited, keeping @Author, and is then stable", async () => {
		const workspace = await createRepo("lm-body-edit", fileWithHeader());
		try {
			await writeFile(join(workspace, "src", "one.mjs"), fileWithHeader({ body: `${BODY}export const two = 2;\n` }), "utf8");

			const first = await runAsJane(workspace);
			expect(first.result.filesUpdated).toBe(1);
			expect(tag(first.content, "Last modified by")).toBe(`${JANE.name} (${JANE.email})`);
			expect(tag(first.content, "Last modified time")).not.toBe(MODIFIED);
			expect(tag(first.content, "Author")).toBe(ORIGINAL.name);
			expect(tag(first.content, "Email")).toBe(`<${ORIGINAL.email}>`);
			expect(first.content).toContain("export const two = 2;");

			const second = await runAsJane(workspace);
			expect(second.result.filesUpdated).toBe(0);
			expect(second.content).toBe(first.content);
		} finally {
			await cleanupWorkspace(workspace);
		}
	});

	it("restamps the time of a new edit by the editor already recorded, once", async () => {
		const committed = fileWithHeader({ editor: JANE });
		const workspace = await createRepo("lm-repeat-editor", committed);
		try {
			await writeFile(join(workspace, "src", "one.mjs"), fileWithHeader({ editor: JANE, body: `${BODY}// more\n` }), "utf8");

			const first = await runAsJane(workspace);
			expect(first.result.filesUpdated).toBe(1);
			expect(tag(first.content, "Last modified by")).toBe(`${JANE.name} (${JANE.email})`);
			expect(tag(first.content, "Last modified time")).not.toBe(MODIFIED);

			const second = await runAsJane(workspace);
			expect(second.result.filesUpdated).toBe(0);
		} finally {
			await cleanupWorkspace(workspace);
		}
	});

	it("still replaces @Author with forceAuthorUpdate, without touching @Last modified by of an unedited file", async () => {
		const workspace = await createRepo("lm-force-author", fileWithHeader());
		try {
			const { result, content } = await runAsJane(workspace, { forceAuthorUpdate: true });
			expect(result.filesUpdated).toBe(1);
			expect(tag(content, "Author")).toBe(JANE.name);
			expect(tag(content, "Email")).toBe(`<${JANE.email}>`);
			expect(tag(content, "Last modified by")).toBe(`${ORIGINAL.name} (${ORIGINAL.email})`);
		} finally {
			await cleanupWorkspace(workspace);
		}
	});

	it("stamps the runner on every changed file with forceLastModifiedAuthorUpdate", async () => {
		const workspace = await createRepo("lm-force-last-modified", fileWithHeader());
		try {
			const { result, content } = await runAsJane(workspace, { forceLastModifiedAuthorUpdate: true });
			expect(result.filesUpdated).toBe(1);
			expect(tag(content, "Last modified by")).toBe(`${JANE.name} (${JANE.email})`);
			expect(tag(content, "Author")).toBe(ORIGINAL.name);
		} finally {
			await cleanupWorkspace(workspace);
		}
	});

	it("treats an untracked file as edited", async () => {
		const workspace = await createRepo("lm-untracked", null);
		try {
			await writeWorkspaceFile(join(workspace, "src", "one.mjs"), fileWithHeader());
			const { result, content } = await runAsJane(workspace);
			expect(result.filesUpdated).toBe(1);
			expect(tag(content, "Last modified by")).toBe(`${JANE.name} (${JANE.email})`);
			expect(tag(content, "Author")).toBe(ORIGINAL.name);
		} finally {
			await cleanupWorkspace(workspace);
		}
	});

	it("gives a new file without a header the runner as author and editor", async () => {
		const workspace = await createRepo("lm-new-no-header", null);
		try {
			await writeWorkspaceFile(join(workspace, "src", "one.mjs"), BODY);
			const { result, content } = await runAsJane(workspace);
			expect(result.filesUpdated).toBe(1);
			expect(tag(content, "Author")).toBe(JANE.name);
			expect(tag(content, "Last modified by")).toBe(`${JANE.name} (${JANE.email})`);
			expect(content.endsWith(`\n\n\n${BODY}`)).toBe(true);
		} finally {
			await cleanupWorkspace(workspace);
		}
	});

	it("does not count adding a header to a committed file as a content edit", async () => {
		const workspace = await createRepo("lm-committed-no-header", BODY);
		try {
			const first = await runAsJane(workspace);
			expect(first.result.filesUpdated).toBe(1);
			// Nothing was recorded before, so both fields take the detected identity.
			expect(tag(first.content, "Author")).toBe(JANE.name);
			expect(tag(first.content, "Last modified by")).toBe(`${JANE.name} (${JANE.email})`);

			// Once committed, a later header-only change by someone else keeps Jane as the editor.
			await commitAsOriginal(workspace, "add header");
			process.env.GIT_CONFIG_GLOBAL = join(globalConfigWorkspace, "other");
			await writeFile(process.env.GIT_CONFIG_GLOBAL, "[user]\n\tname = Someone Else\n\temail = else@example.com\n", "utf8");
			const second = await runAsJane(workspace, { normalizeDateFormat: true });
			expect(second.result.filesUpdated).toBe(1);
			expect(tag(second.content, "Last modified by")).toBe(`${JANE.name} (${JANE.email})`);
			expect(tag(second.content, "Author")).toBe(JANE.name);
		} finally {
			await cleanupWorkspace(workspace);
		}
	});

	it("keeps the recorded editor outside a git work tree, where content edits cannot be detected", async () => {
		const previousCeiling = process.env.GIT_CEILING_DIRECTORIES;
		const workspace = await createWorkspace("lm-no-git");
		// Stop git's repository discovery at the fixture root, so this repository's own .git is not found.
		process.env.GIT_CEILING_DIRECTORIES = FIXTURE_ROOT;
		try {
			await writeWorkspaceFile(join(workspace, "package.json"), JSON.stringify({ name: PROJECT }, null, 2));
			await writeWorkspaceFile(join(workspace, "src", "one.mjs"), fileWithHeader({ body: `${BODY}// edited\n` }));
			expect((await readGitHeadFile(join(workspace, "src", "one.mjs"))).state).toBe("no-git");

			const { result, content } = await runAsJane(workspace, { normalizeDateFormat: true, authorName: JANE.name, authorEmail: JANE.email });
			expect(result.filesUpdated).toBe(1);
			expect(tag(content, "Last modified by")).toBe(`${ORIGINAL.name} (${ORIGINAL.email})`);
			expect(tag(content, "Author")).toBe(ORIGINAL.name);
		} finally {
			if (previousCeiling === undefined) {
				delete process.env.GIT_CEILING_DIRECTORIES;
			} else {
				process.env.GIT_CEILING_DIRECTORIES = previousCeiling;
			}
			await cleanupWorkspace(workspace);
		}
	});
});

describe("readGitHeadFile", () => {
	it("reads a committed file, including an empty one, and reports files HEAD does not have", async () => {
		const workspace = await createRepo("lm-read-head", "");
		try {
			expect(await readGitHeadFile(join(workspace, "src", "one.mjs"))).toEqual({ state: "tracked", content: "" });
			await writeWorkspaceFile(join(workspace, "src", "two.mjs"), BODY);
			expect(await readGitHeadFile(join(workspace, "src", "two.mjs"))).toEqual({ state: "untracked", content: null });
		} finally {
			await cleanupWorkspace(workspace);
		}
	});
});

describe("extractHeaderlessBody", () => {
	it("gives the same body whatever the header, framing or margin", () => {
		const withHeader = fileWithHeader();
		expect(extractHeaderlessBody(withHeader, "/x/src/one.mjs")).toBe(BODY);
		expect(extractHeaderlessBody(withHeader.replace(" */\n\n\n", " */\n"), "/x/src/one.mjs")).toBe(BODY);
		expect(extractHeaderlessBody(BODY, "/x/src/one.mjs")).toBe(BODY);
		expect(extractHeaderlessBody(`\n\n${BODY}`, "/x/src/one.mjs")).toBe(BODY);
	});

	it("keeps a preserved prefix and treats a whitespace-only body as empty", () => {
		const shebang = "#!/usr/bin/env node\n";
		expect(extractHeaderlessBody(`${shebang}${fileWithHeader()}`, "/x/src/one.mjs")).toBe(`${shebang}${BODY}`);
		expect(extractHeaderlessBody(`${shebang}${BODY}`, "/x/src/one.mjs")).toBe(`${shebang}${BODY}`);
		expect(extractHeaderlessBody(fileWithHeader({ body: "\n  \n" }), "/x/src/one.mjs")).toBe("");
		expect(extractHeaderlessBody("\n\n", "/x/src/one.mjs")).toBe("");
	});
});
