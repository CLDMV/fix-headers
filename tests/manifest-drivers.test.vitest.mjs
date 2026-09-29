/**
 *	@Project: @cldmv/fix-headers
 *	@Filename: /tests/manifest-drivers.test.vitest.mjs
 *	@Date: 2026-09-28T19:40:00-07:00 (1790649600)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-09-28T19:40:00-07:00 (1790649600)
 *	-----
 *	@Copyright: Copyright (c) 2026-2026 Catalyzed Motivation Inc. All rights reserved.
 */

import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { claimFolder, getDriverById, MANIFEST_DRIVERS, resolveManifestProject } from "../src/drivers/index.mjs";
import { cleanName, detectManifests, parseJsonManifest, readIniValue, readTomlString } from "../src/drivers/shared.mjs";
import { cleanupWorkspace, createIsolatedWorkspace, createWorkspace, writeWorkspaceFile } from "./helpers/workspace.mjs";

/**
 * @fileoverview Unit checks for the manifest drivers: each driver's `detect` and `read`,
 * including malformed and nameless manifests, the shared manifest readers, and the registry's
 * folder claiming and project resolution.
 * @module fix-headers/tests/manifest-drivers
 */

/**
 * Detects and reads one driver's manifests written into a fresh folder.
 * @param {string} driverId - Driver id.
 * @param {Record<string, string>} files - Manifest filename → content.
 * @returns {Promise<{ detection: import("../src/drivers/shared.mjs").DriverDetection | null, data: { name?: string } | null }>} Result.
 */
async function detectAndRead(driverId, files) {
	const workspace = await createWorkspace(`driver-${driverId}`);
	try {
		for (const [file, content] of Object.entries(files)) {
			await writeWorkspaceFile(join(workspace, file), content);
		}
		const driver = /** @type {import("../src/drivers/index.mjs").ManifestDriver} */ (getDriverById(driverId));
		const detection = await driver.detect(workspace);
		return { detection, data: detection ? driver.read(detection) : null };
	} finally {
		await cleanupWorkspace(workspace);
	}
}

describe("manifest drivers", () => {
	it("registers node, python, php, rust, go in that order", () => {
		expect(MANIFEST_DRIVERS.map((driver) => driver.id)).toEqual(["node", "python", "php", "rust", "go"]);
		expect(getDriverById("python")?.manifests).toEqual(["pyproject.toml", "setup.cfg", "setup.py"]);
		expect(getDriverById("unknown")).toBeUndefined();
	});

	it("node: a VS Code extension's name is its Marketplace identifier <publisher>.<name>", async () => {
		const extension = { name: "jsonv-vscode", publisher: " cldmv ", engines: { vscode: "^1.88.0" } };
		expect((await detectAndRead("node", { "package.json": JSON.stringify(extension) })).data).toEqual({ name: "cldmv.jsonv-vscode" });
		// A publisher field alone doesn't make a VS Code extension, and an extension needs a publisher.
		expect((await detectAndRead("node", { "package.json": JSON.stringify({ ...extension, engines: { node: ">=22" } }) })).data).toEqual({
			name: "jsonv-vscode"
		});
		expect((await detectAndRead("node", { "package.json": JSON.stringify({ ...extension, engines: undefined }) })).data).toEqual({
			name: "jsonv-vscode"
		});
		expect((await detectAndRead("node", { "package.json": JSON.stringify({ ...extension, publisher: " " }) })).data).toEqual({
			name: "jsonv-vscode"
		});
		// Without a name there is nothing to qualify.
		expect((await detectAndRead("node", { "package.json": JSON.stringify({ ...extension, name: undefined }) })).data).toEqual({
			name: undefined
		});
	});

	it("node: package.json name, trimmed; none when missing, blank, not a string or malformed", async () => {
		expect((await detectAndRead("node", { "package.json": '{ "name": " @scope/pkg " }' })).data).toEqual({ name: "@scope/pkg" });
		expect((await detectAndRead("node", { "package.json": '{ "version": "1.0.0" }' })).data).toEqual({ name: undefined });
		expect((await detectAndRead("node", { "package.json": '{ "name": "   " }' })).data).toEqual({ name: undefined });
		expect((await detectAndRead("node", { "package.json": '{ "name": 42 }' })).data).toEqual({ name: undefined });
		expect((await detectAndRead("node", { "package.json": "null" })).data).toEqual({ name: undefined });
		const malformed = await detectAndRead("node", { "package.json": "{ not json" });
		expect(malformed.detection?.manifest).toBe("package.json");
		expect(malformed.data).toEqual({ name: undefined });
		expect((await detectAndRead("node", { "composer.json": "{}" })).detection).toBeNull();
	});

	it("php: composer.json name; none when missing or malformed", async () => {
		expect((await detectAndRead("php", { "composer.json": '{ "name": "vendor/pkg" }' })).data).toEqual({ name: "vendor/pkg" });
		expect((await detectAndRead("php", { "composer.json": "{}" })).data).toEqual({ name: undefined });
		expect((await detectAndRead("php", { "composer.json": "{ nope" })).data).toEqual({ name: undefined });
		expect((await detectAndRead("php", { "package.json": "{}" })).detection).toBeNull();
	});

	it("rust: [package].name only", async () => {
		expect((await detectAndRead("rust", { "Cargo.toml": '[package]\nname = "crate-a"\nversion = "0.1.0"\n' })).data).toEqual({
			name: "crate-a"
		});
		// A [[bin]] or dependency table's name is not the package name; the [package] table still is.
		expect(
			(
				await detectAndRead("rust", {
					"Cargo.toml": '[[bin]]\nname = "tool"\n\n[dependencies.serde]\nname = "x"\n\n[package]\nname = \'crate-b\'\n'
				})
			).data
		).toEqual({ name: "crate-b" });
		expect((await detectAndRead("rust", { "Cargo.toml": '[workspace]\nmembers = ["a"]\n' })).data).toEqual({ name: undefined });
		expect((await detectAndRead("rust", { "Cargo.toml": "[package\nname = = broken" })).data).toEqual({ name: undefined });
	});

	it("go: the module path, without a comment or quotes", async () => {
		expect((await detectAndRead("go", { "go.mod": "module example.com/a\n\ngo 1.22\n" })).data).toEqual({ name: "example.com/a" });
		expect((await detectAndRead("go", { "go.mod": 'module "example.com/b" // quoted\n' })).data).toEqual({ name: "example.com/b" });
		expect((await detectAndRead("go", { "go.mod": "go 1.22\n" })).data).toEqual({ name: undefined });
		expect((await detectAndRead("go", { "go.mod": "module    \n" })).data).toEqual({ name: undefined });
	});

	it("python: pyproject [project] then [tool.poetry], setup.cfg [metadata], setup.py setup(name=...)", async () => {
		expect((await detectAndRead("python", { "pyproject.toml": '[project]\nname = "pep621"\n' })).data).toEqual({ name: "pep621" });
		expect(
			(await detectAndRead("python", { "pyproject.toml": '[ tool . poetry ]\n# name = "commented"\nname = "poetry-name"\n' })).data
		).toEqual({
			name: "poetry-name"
		});
		expect(
			(await detectAndRead("python", { "pyproject.toml": '[project]\nname = "pep621"\n[tool.poetry]\nname = "poetry"\n' })).data
		).toEqual({
			name: "pep621"
		});
		expect((await detectAndRead("python", { "setup.cfg": "[flake8]\nname = nope\n[metadata]\nname: cfg-name\n" })).data).toEqual({
			name: "cfg-name"
		});
		expect((await detectAndRead("python", { "setup.py": 'NAME = "x"\nsetup(\n    name = "setup-name",\n)\n' })).data).toEqual({
			name: "setup-name"
		});

		// pyproject.toml without a name falls through to setup.cfg, then setup.py.
		const layered = await detectAndRead("python", {
			"pyproject.toml": '[build-system]\nrequires = ["setuptools"]\n',
			"setup.cfg": "[metadata]\nname =\n",
			"setup.py": 'from setuptools import setup\nsetup(name="from-setup-py")\n'
		});
		expect(layered.detection?.manifest).toBe("pyproject.toml");
		expect(layered.detection?.files.map((entry) => entry.file)).toEqual(["pyproject.toml", "setup.cfg", "setup.py"]);
		expect(layered.data).toEqual({ name: "from-setup-py" });

		expect((await detectAndRead("python", { "setup.py": "import setuptools\n" })).data).toEqual({ name: undefined });
		expect((await detectAndRead("python", { "setup.py": "setup(version='1')\n" })).data).toEqual({ name: undefined });
		expect((await detectAndRead("python", { "setup.py": "setup(name='   ')\n" })).data).toEqual({ name: undefined });
		expect((await detectAndRead("python", { "pyproject.toml": '[project]\nname = ""\n' })).data).toEqual({ name: undefined });
		// requirements.txt carries no name and does not claim a folder.
		expect((await detectAndRead("python", { "requirements.txt": "requests\n" })).detection).toBeNull();
	});

	it("a manifest that can't be read as a file does not claim the folder", async () => {
		const workspace = await createWorkspace("driver-unreadable");
		try {
			await mkdir(join(workspace, "package.json"));
			expect(await detectManifests(workspace, ["package.json"])).toBeNull();
			expect(await getDriverById("node")?.detect(workspace)).toBeNull();
		} finally {
			await cleanupWorkspace(workspace);
		}
	});
});

describe("shared manifest readers", () => {
	it("cleanName, parseJsonManifest, readTomlString and readIniValue", () => {
		expect(cleanName("  a ")).toBe("a");
		expect(cleanName(" ")).toBeUndefined();
		expect(cleanName(1)).toBeUndefined();
		expect(parseJsonManifest('{"name":"x"}')).toEqual({ name: "x" });
		expect(parseJsonManifest("[")).toBeUndefined();
		expect(readTomlString('title = "top"\n[a]\nkey = "v"\n', "a", "key")).toBe("v");
		expect(readTomlString('key = "top-level"\n', "a", "key")).toBeUndefined();
		expect(readTomlString("[a]\nkey = 1\n", "a", "key")).toBeUndefined();
		expect(readIniValue("[s]\r\nkey = value \r\n", "s", "key")).toBe("value");
		expect(readIniValue("[s]\nother = 1\n", "s", "key")).toBeUndefined();
	});
});

describe("folder claims and project resolution", () => {
	it("claimFolder orders the native driver first, then the registry order", async () => {
		const workspace = await createWorkspace("driver-claims");
		try {
			await writeWorkspaceFile(join(workspace, "package.json"), '{"name":"n"}');
			await writeWorkspaceFile(join(workspace, "go.mod"), "module g\n");
			await writeWorkspaceFile(join(workspace, "pyproject.toml"), '[project]\nname = "p"\n');
			const ids = async (language) => (await claimFolder(workspace, MANIFEST_DRIVERS, language)).map((claim) => claim.driver.id);
			expect(await ids(undefined)).toEqual(["node", "python", "go"]);
			expect(await ids("go")).toEqual(["go", "node", "python"]);
			expect(await ids("css")).toEqual(["node", "python", "go"]);
		} finally {
			await cleanupWorkspace(workspace);
		}
	});

	it("resolveManifestProject climbs only inside the scan root, and only for missing values", async () => {
		const workspace = await createWorkspace("driver-resolve");
		try {
			await writeWorkspaceFile(join(workspace, "package.json"), '{"name":"outer"}');
			await writeWorkspaceFile(join(workspace, "a", "b", "composer.json"), "{}");
			const start = join(workspace, "a", "b", "c");
			await mkdir(start, { recursive: true });

			const climbed = await resolveManifestProject(start, { scanRoot: workspace });
			expect(climbed).toEqual({
				root: join(workspace, "a", "b"),
				marker: "composer.json",
				drivers: ["php"],
				fields: { name: "outer" },
				sources: { name: { driver: "node", manifest: "package.json", dir: workspace } }
			});

			// Without a scan root, or with the root outside it, nothing climbs.
			expect((await resolveManifestProject(start))?.fields).toEqual({});
			expect((await resolveManifestProject(start, { scanRoot: join(workspace, "elsewhere") }))?.fields).toEqual({});
			expect((await resolveManifestProject(start, { scanRoot: join(workspace, "a", "b") }))?.fields).toEqual({});
			// Custom drivers replace the registry: with none, the walk ends at the enclosing repository.
			expect(await resolveManifestProject(start, { drivers: [], scanRoot: workspace })).toMatchObject({
				marker: ".git",
				drivers: [],
				fields: {}
			});
		} finally {
			await cleanupWorkspace(workspace);
		}
	});

	it("returns null with neither a manifest nor a repository up to the filesystem root", async () => {
		const workspace = await createIsolatedWorkspace("driver-none");
		try {
			expect(await resolveManifestProject(workspace)).toBeNull();
		} finally {
			await cleanupWorkspace(workspace);
		}
	});
});
