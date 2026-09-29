/**
 *	@Project: @cldmv/fix-headers
 *	@Filename: /tests/copyright-holder.test.vitest.mjs
 *	@Date: 2026-09-28T21:55:00-07:00 (1790657700)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-09-28T21:55:00-07:00 (1790657700)
 *	-----
 *	@Copyright: Copyright (c) 2026-2026 Catalyzed Motivation Inc. All rights reserved.
 */

import { mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveProjectMetadata } from "../src/detect/project.mjs";
import { getDriverById, resolveManifestProject } from "../src/drivers/index.mjs";
import { parseJsonManifest, personName, readTomlAuthor } from "../src/drivers/shared.mjs";
import { fixHeaders } from "../src/fix-header.mjs";
import { compareHeaderFields, parseHeaderFields } from "../src/header/fields.mjs";
import { buildHeader } from "../src/header/template.mjs";
import { cleanupWorkspace, createWorkspace, writeWorkspaceFile } from "./helpers/workspace.mjs";

/**
 * @fileoverview The `@Copyright` holder: read from the project's manifests through the manifest
 * drivers (each driver's author field), climbing like the project name, overridden by
 * `companyName`, and omitted from the `@Copyright` line when nothing provides one.
 * @module fix-headers/tests/copyright-holder
 */

/**
 * Timeout for tests that run the full pipeline, which spawns git processes for every file:
 * beyond vitest's 5s default on a loaded machine.
 */
const GIT_FIXTURE_TIMEOUT = { timeout: 30_000 };

/** The year of the run, the `@Copyright` start and end year of a new header without `copyrightStartYear`. */
const CURRENT_YEAR = new Date().getFullYear();

/** Options that pin the author identity, so only the holder varies between runs. */
const IDENTITY = { authorName: "Holder Tester", authorEmail: "holder@example.com", copyrightStartYear: CURRENT_YEAR };

/**
 * Writes files relative to a workspace.
 * @param {string} workspace - Workspace path.
 * @param {Record<string, string>} files - Relative path → content.
 * @returns {Promise<void>} Completion promise.
 */
async function writeFiles(workspace, files) {
	for (const [relativePath, content] of Object.entries(files)) {
		await writeWorkspaceFile(join(workspace, relativePath), content);
	}
}

/**
 * Detects and reads one driver's manifests written into a fresh folder, returning the holder.
 * @param {string} driverId - Driver id.
 * @param {Record<string, string>} files - Manifest filename → content.
 * @returns {Promise<string | undefined>} The `company` the driver reads.
 */
async function readCompany(driverId, files) {
	const workspace = await createWorkspace(`holder-${driverId}`);
	try {
		await writeFiles(workspace, files);
		const driver = /** @type {import("../src/drivers/index.mjs").ManifestDriver} */ (getDriverById(driverId));
		const detection = await driver.detect(workspace);
		return detection ? driver.read(detection).company : undefined;
	} finally {
		await cleanupWorkspace(workspace);
	}
}

/**
 * Reads the `@Copyright` value of a workspace file.
 * @param {string} workspace - Workspace path.
 * @param {string} file - Project-relative file path.
 * @returns {Promise<string | undefined>} The text after `@Copyright: `.
 */
async function readCopyright(workspace, file) {
	return (await readFile(join(workspace, file), "utf8")).match(/@Copyright: (.*)$/m)?.[1];
}

describe("each manifest driver's copyright holder", () => {
	it("node: author.company, else author.name, else the name part of a string author", async () => {
		const pkg = (author) => ({ "package.json": JSON.stringify({ name: "n", author }) });
		expect(await readCompany("node", pkg({ name: "Jane Doe", company: " ACME Corp " }))).toBe("ACME Corp");
		expect(await readCompany("node", pkg({ name: "Jane Doe", email: "jane@example.com" }))).toBe("Jane Doe");
		expect(await readCompany("node", pkg({ name: "Jane Doe", company: "  " }))).toBe("Jane Doe");
		expect(await readCompany("node", pkg("Barney Rubble <b@rubble.com> (http://barnyrubble.tumblr.com/)"))).toBe("Barney Rubble");
		expect(await readCompany("node", pkg("Barney Rubble (http://barnyrubble.tumblr.com/)"))).toBe("Barney Rubble");
		expect(await readCompany("node", pkg("Plain Name"))).toBe("Plain Name");
		expect(await readCompany("node", pkg("<only@example.com>"))).toBeUndefined();
		expect(await readCompany("node", pkg({ email: "x@example.com" }))).toBeUndefined();
		expect(await readCompany("node", pkg(null))).toBeUndefined();
		expect(await readCompany("node", pkg(42))).toBeUndefined();
		expect(await readCompany("node", { "package.json": '{ "name": "no-author" }' })).toBeUndefined();
		expect(await readCompany("node", { "package.json": "{ not json" })).toBeUndefined();
	});

	it("python: pyproject [project].authors[0].name, then [tool.poetry].authors[0]; setup.cfg author; setup.py author=", async () => {
		const pep621 =
			'[project]\nname = "p"\nauthors = [\n  # the maintainer\n  { name = "Pep Author", email = "pep@example.com" },\n  { name = "Second" },\n]\n';
		expect(await readCompany("python", { "pyproject.toml": pep621 })).toBe("Pep Author");
		expect(
			await readCompany("python", { "pyproject.toml": "[project]\nauthors = [{ email = 'e@example.com', name = 'Single Quoted' }]\n" })
		).toBe("Single Quoted");
		expect(await readCompany("python", { "pyproject.toml": '[tool.poetry]\nauthors = ["Poetry Author <poetry@example.com>"]\n' })).toBe(
			"Poetry Author"
		);
		// [project] wins over [tool.poetry]; a [project] author without a name falls through to Poetry.
		expect(
			await readCompany("python", {
				"pyproject.toml": '[project]\nauthors = [{ name = "Pep" }]\n[tool.poetry]\nauthors = ["Poetry <p@example.com>"]\n'
			})
		).toBe("Pep");
		expect(
			await readCompany("python", {
				"pyproject.toml":
					'[project]\nauthors = [{ email = "e@example.com", username = "no" }]\n[tool.poetry]\nauthors = ["Poetry <p@example.com>"]\n'
			})
		).toBe("Poetry");
		expect(
			await readCompany("python", { "setup.cfg": "[metadata]\nname = cfg\nauthor_email = a@example.com\nauthor = Cfg Author\n" })
		).toBe("Cfg Author");
		expect(
			await readCompany("python", {
				"setup.py": 'from setuptools import setup\nsetup(name="x", author_email="a@b.c", author="Setup Author")\n'
			})
		).toBe("Setup Author");

		// pyproject.toml without authors falls through to setup.cfg, then setup.py.
		expect(
			await readCompany("python", {
				"pyproject.toml": '[project]\nname = "p"\nauthors = []\n',
				"setup.cfg": "[metadata]\nname = cfg\n",
				"setup.py": 'setup(author="From Setup Py")\n'
			})
		).toBe("From Setup Py");
		expect(await readCompany("python", { "pyproject.toml": '[project]\nname = "p"\n' })).toBeUndefined();
		expect(await readCompany("python", { "setup.py": "import setuptools\n" })).toBeUndefined();
	});

	it("php: composer.json authors[0].name", async () => {
		expect(await readCompany("php", { "composer.json": JSON.stringify({ authors: [{ name: "Php Author" }, { name: "Second" }] }) })).toBe(
			"Php Author"
		);
		expect(await readCompany("php", { "composer.json": JSON.stringify({ authors: [{ email: "e@example.com" }] }) })).toBeUndefined();
		expect(await readCompany("php", { "composer.json": JSON.stringify({ authors: [null] }) })).toBeUndefined();
		expect(await readCompany("php", { "composer.json": JSON.stringify({ authors: "Not An Array" }) })).toBeUndefined();
		expect(await readCompany("php", { "composer.json": "{ nope" })).toBeUndefined();
	});

	it("rust: the name part of [package].authors[0]", async () => {
		expect(
			await readCompany("rust", { "Cargo.toml": '[package]\nname = "c"\nauthors = ["Rust Author <rust@example.com>", "Second"]\n' })
		).toBe("Rust Author");
		// An inherited `authors.workspace = true`, or authors outside [package], provide none.
		expect(await readCompany("rust", { "Cargo.toml": '[package]\nname = "c"\nauthors.workspace = true\n' })).toBeUndefined();
		expect(await readCompany("rust", { "Cargo.toml": '[workspace.package]\nauthors = ["Workspace <w@example.com>"]\n' })).toBeUndefined();
	});

	it("go: go.mod has no author and provides none", async () => {
		expect(await readCompany("go", { "go.mod": "module example.com/a\n\ngo 1.22\n" })).toBeUndefined();
	});
});

describe("shared author readers", () => {
	it("personName, parseJsonManifest and readTomlAuthor", () => {
		expect(personName(" Jane Doe <jane@example.com> (https://example.com) ")).toBe("Jane Doe");
		expect(personName("(https://example.com)")).toBeUndefined();
		expect(personName(undefined)).toBeUndefined();
		expect(parseJsonManifest('{"a":1}')).toEqual({ a: 1 });
		expect(parseJsonManifest("[")).toBeUndefined();

		expect(readTomlAuthor('[package]\nauthors = ["A <a@example.com>"]\n', "package")).toBe("A");
		expect(readTomlAuthor("[package]\nauthors = ['Single <s@example.com>']\n", "package")).toBe("Single");
		expect(readTomlAuthor('[package]\nauthors = [ # trailing comment\n\t"Next Line"\n]\n', "package")).toBe("Next Line");
		expect(readTomlAuthor("[package]\nauthors = [\n# only a comment", "package")).toBeUndefined();
		expect(readTomlAuthor('[package]\nauthors = [{ name = "" }]\n', "package")).toBeUndefined();
		expect(readTomlAuthor('[package]\nauthors = [{ name = "Unclosed"', "package")).toBeUndefined();
		expect(readTomlAuthor('[package]\nauthors = [42, "Later"]\n', "package")).toBeUndefined();
		expect(readTomlAuthor('authors = ["Top Level"]\n[package]\nname = "x"\n', "package")).toBeUndefined();
	});
});

describe("holder resolution through the manifests", () => {
	it("a holder missing from the nearest manifests climbs to a parent's; the name stays the nearest", async () => {
		const workspace = await createWorkspace("holder-resolve");
		try {
			await writeFiles(workspace, {
				"package.json": JSON.stringify({ name: "outer", author: { name: "Outer Author", company: "Outer Co" } }),
				"packages/a/package.json": JSON.stringify({ name: "inner" })
			});
			const start = join(workspace, "packages", "a");
			expect(await resolveManifestProject(start, { scanRoot: workspace })).toEqual({
				root: start,
				marker: "package.json",
				drivers: ["node"],
				fields: { name: "inner", company: "Outer Co" },
				sources: {
					name: { driver: "node", manifest: "package.json", dir: start },
					company: { driver: "node", manifest: "package.json", dir: workspace }
				}
			});
			// Without a scan root nothing climbs, so there is no holder.
			expect((await resolveManifestProject(start))?.fields).toEqual({ name: "inner" });
		} finally {
			await cleanupWorkspace(workspace);
		}
	});

	it("resolveProjectMetadata: companyName overrides the manifest; blank or missing leaves it to the manifests", async () => {
		const workspace = await createWorkspace("holder-metadata");
		try {
			await writeFiles(workspace, { "package.json": JSON.stringify({ name: "m", author: "Manifest Holder <m@example.com>" }) });
			const base = { cwd: workspace, authorName: "A", authorEmail: "a@example.com" };
			expect(await resolveProjectMetadata(base)).toMatchObject({
				companyName: "Manifest Holder",
				companyNameSource: { from: "manifest", driver: "node", manifest: "package.json", dir: workspace }
			});
			expect(await resolveProjectMetadata({ ...base, companyName: " Option Co " })).toMatchObject({
				companyName: "Option Co",
				companyNameSource: { from: "option" }
			});
			expect(await resolveProjectMetadata({ ...base, companyName: "   " })).toMatchObject({
				companyName: "Manifest Holder",
				companyNameSource: { from: "manifest" }
			});
		} finally {
			await cleanupWorkspace(workspace);
		}
	}, 30_000);
});

describe("the @Copyright line", () => {
	const headerData = {
		absoluteFilePath: "/project/src/main.mjs",
		language: "node",
		projectRoot: "/project",
		projectName: "p",
		authorName: "A",
		authorEmail: "a@example.com",
		createdAt: { date: "2026-01-01 00:00:00 +00:00", timestamp: 1767225600 },
		lastModifiedAt: { date: "2026-01-01 00:00:00 +00:00", timestamp: 1767225600 },
		copyrightStartYear: 2019,
		currentYear: 2026
	};

	it("omits the holder cleanly when there is none, and keeps it when there is one", () => {
		for (const companyName of [null, undefined, "", "   "]) {
			expect(buildHeader({ ...headerData, companyName })).toContain(" *\t@Copyright: Copyright (c) 2019-2026 All rights reserved.\n");
		}
		expect(buildHeader({ ...headerData, companyName: " ACME " })).toContain(
			"@Copyright: Copyright (c) 2019-2026 ACME All rights reserved.\n"
		);
	});

	it("parses a holder-less line, and reports a dropped or added holder as a companyName issue", () => {
		const without = buildHeader({ ...headerData, companyName: null });
		const withHolder = buildHeader({ ...headerData, companyName: "Catalyzed Motivation Inc." });
		expect(parseHeaderFields(without)).toMatchObject({ copyrightStartYear: "2019", copyrightEndYear: "2026", companyName: null });
		expect(parseHeaderFields("#\t@Copyright: Copyright (c) 2020 All rights reserved.")).toMatchObject({
			copyrightStartYear: "2020",
			copyrightEndYear: null,
			companyName: null
		});
		expect(compareHeaderFields(withHolder, without)).toEqual([
			{ field: "companyName", previous: "Catalyzed Motivation Inc.", detected: null }
		]);
		expect(compareHeaderFields(without, withHolder)).toEqual([
			{ field: "companyName", previous: null, detected: "Catalyzed Motivation Inc." }
		]);
		expect(compareHeaderFields(without, without)).toEqual([]);
	});
});

describe("fixHeaders writes the resolved holder", () => {
	it("takes the holder from each ecosystem's manifest", GIT_FIXTURE_TIMEOUT, async () => {
		const projects = {
			"node/package.json": JSON.stringify({ name: "node-p", author: { name: "Node Person", company: "Node Co" } }),
			"node/src/a.css": "a {}\n",
			"python/pyproject.toml": '[project]\nname = "py-p"\nauthors = [{ name = "Py Person" }]\n',
			"python/src/a.py": "x = 1\n",
			"php/composer.json": JSON.stringify({ name: "v/php-p", authors: [{ name: "Php Person" }] }),
			"php/src/a.php": "<?php echo 1;\n",
			"rust/Cargo.toml": '[package]\nname = "rust-p"\nauthors = ["Rust Person <r@example.com>"]\n',
			"rust/src/a.rs": "fn main() {}\n",
			"go/go.mod": "module example.com/go-p\n",
			"go/src/a.go": "package main\n"
		};
		const workspace = await createWorkspace("holder-ecosystems");
		try {
			await writeFiles(workspace, { "package.json": JSON.stringify({ name: "holder-ecosystems" }), ...projects });
			const result = await fixHeaders({
				cwd: workspace,
				...IDENTITY,
				includeFolders: ["node", "python", "php", "rust", "go"],
				sampleOutput: true
			});
			const holders = Object.fromEntries(
				result.changes.map((change) => [change.file.replace(/\\/g, "/"), change.sample?.detectedValues?.companyName])
			);
			expect(holders).toEqual({
				"node/src/a.css": "Node Co",
				"python/src/a.py": "Py Person",
				"php/src/a.php": "Php Person",
				"rust/src/a.rs": "Rust Person",
				"go/src/a.go": null
			});
			expect(await readCopyright(workspace, "python/src/a.py")).toBe(
				`Copyright (c) ${CURRENT_YEAR}-${CURRENT_YEAR} Py Person All rights reserved.`
			);
			expect(await readCopyright(workspace, "go/src/a.go")).toBe(`Copyright (c) ${CURRENT_YEAR}-${CURRENT_YEAR} All rights reserved.`);
			const rust = result.changes.find((change) => change.file.replace(/\\/g, "/") === "rust/src/a.rs");
			expect(rust?.sample?.detectedValues?.companyNameSource).toEqual({
				from: "manifest",
				driver: "rust",
				manifest: "Cargo.toml",
				dir: join(workspace, "rust")
			});
		} finally {
			await cleanupWorkspace(workspace);
		}
	});

	it("climbs to the repository manifest's holder for a sub-package without an author", GIT_FIXTURE_TIMEOUT, async () => {
		const workspace = await createWorkspace("holder-climb");
		try {
			await writeFiles(workspace, {
				"package.json": JSON.stringify({ name: "@scope/repo", author: "Repo Owner <owner@example.com>" }),
				"packages/a/package.json": JSON.stringify({ name: "@scope/a" }),
				"packages/a/src/x.mjs": "export const x = 1;\n"
			});
			const result = await fixHeaders({ cwd: workspace, ...IDENTITY, includeFolders: ["packages"], sampleOutput: true });
			const { detectedValues } = result.changes[0].sample;
			expect(detectedValues).toMatchObject({ projectName: "@scope/a", companyName: "Repo Owner" });
			expect(detectedValues.companyNameSource).toEqual({ from: "manifest", driver: "node", manifest: "package.json", dir: workspace });
			expect(await readCopyright(workspace, "packages/a/src/x.mjs")).toBe(
				`Copyright (c) ${CURRENT_YEAR}-${CURRENT_YEAR} Repo Owner All rights reserved.`
			);
		} finally {
			await cleanupWorkspace(workspace);
		}
	});

	it("companyName overrides every manifest", GIT_FIXTURE_TIMEOUT, async () => {
		const workspace = await createWorkspace("holder-option");
		try {
			await writeFiles(workspace, {
				"package.json": JSON.stringify({ name: "p", author: { company: "Manifest Co" } }),
				"src/x.mjs": "export const x = 1;\n"
			});
			const result = await fixHeaders({ cwd: workspace, ...IDENTITY, companyName: "Option Co", sampleOutput: true });
			expect(result.metadata).toMatchObject({ companyName: "Option Co", companyNameSource: { from: "option" } });
			expect(result.changes[0].sample.detectedValues).toMatchObject({ companyName: "Option Co", companyNameSource: { from: "option" } });
			expect(await readCopyright(workspace, "src/x.mjs")).toBe(
				`Copyright (c) ${CURRENT_YEAR}-${CURRENT_YEAR} Option Co All rights reserved.`
			);
		} finally {
			await cleanupWorkspace(workspace);
		}
	});

	it("omits the holder when nothing provides one, and a second run leaves the header alone", GIT_FIXTURE_TIMEOUT, async () => {
		const workspace = await createWorkspace("holder-none");
		try {
			await writeFiles(workspace, {
				"package.json": JSON.stringify({ name: "no-holder" }),
				"src/new.mjs": "export const x = 1;\n",
				"src/old.mjs": `/**\n *\t@Project: no-holder\n *\t@Filename: /src/old.mjs\n *\t@Date: 2026-01-01 00:00:00 +00:00 (1767225600)\n *\t@Author: Holder Tester\n *\t@Email: <holder@example.com>\n *\t-----\n *\t@Last modified by: Holder Tester (holder@example.com)\n *\t@Last modified time: 2026-01-02 00:00:00 +00:00 (1767312000)\n *\t-----\n *\t@Copyright: Copyright (c) ${CURRENT_YEAR}-${CURRENT_YEAR} Catalyzed Motivation Inc. All rights reserved.\n */\n\nexport const old = true;\n`
			});
			const result = await fixHeaders({ cwd: workspace, ...IDENTITY, sampleOutput: true });
			expect(result.metadata).toMatchObject({ companyName: null, companyNameSource: { from: "none" } });
			const byFile = Object.fromEntries(result.changes.map((change) => [change.file.replace(/\\/g, "/"), change]));
			expect(byFile["src/new.mjs"].sample.detectedValues).toMatchObject({ companyName: null, companyNameSource: { from: "none" } });
			expect(byFile["src/old.mjs"].sample.issues).toContainEqual({
				field: "companyName",
				previous: "Catalyzed Motivation Inc.",
				detected: null
			});
			for (const file of ["src/new.mjs", "src/old.mjs"]) {
				expect(await readCopyright(workspace, file)).toBe(`Copyright (c) ${CURRENT_YEAR}-${CURRENT_YEAR} All rights reserved.`);
			}

			const second = await fixHeaders({ cwd: workspace, ...IDENTITY });
			expect(second.filesUpdated).toBe(0);
			expect(second.changes.every((change) => change.changed === false)).toBe(true);
		} finally {
			await cleanupWorkspace(workspace);
		}
	});

	it("a sub-folder without a manifest takes the holder of the project it sits in", GIT_FIXTURE_TIMEOUT, async () => {
		const workspace = await createWorkspace("holder-subfolder");
		try {
			await writeFiles(workspace, { "composer.json": JSON.stringify({ authors: [{ name: "Composer Owner" }] }) });
			await mkdir(join(workspace, "lib", "deep"), { recursive: true });
			await writeFiles(workspace, { "lib/deep/a.php": "<?php echo 1;\n" });
			await fixHeaders({ cwd: workspace, ...IDENTITY });
			expect(await readCopyright(workspace, "lib/deep/a.php")).toBe(
				`Copyright (c) ${CURRENT_YEAR}-${CURRENT_YEAR} Composer Owner All rights reserved.`
			);
		} finally {
			await cleanupWorkspace(workspace);
		}
	});
});
