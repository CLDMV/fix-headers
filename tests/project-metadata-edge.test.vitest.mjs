import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { detector as nodeDetector } from "../src/detectors/node.mjs";
import { detectProjectFromMarkers, resolveProjectMetadata } from "../src/detect/project.mjs";
import { cleanupWorkspace, createWorkspace, writeWorkspaceFile } from "./helpers/workspace.mjs";

const execFileAsync = promisify(execFile);

describe("project metadata edge branches", () => {
	it("skips detectors missing findNearestConfig and prefers deeper roots", async () => {
		const detectorWithoutFinder = {
			id: "no-finder",
			extensions: [".mjs"],
			parseProjectName() {
				return "ignored";
			}
		};

		const shallowDetector = {
			id: "shallow",
			extensions: [".mjs"],
			priority: 1,
			async findNearestConfig() {
				return {
					root: "/srv/repos/fix-headers",
					marker: "missing-a.marker"
				};
			},
			parseProjectName() {
				return "shallow";
			}
		};

		const deepDetector = {
			id: "deep",
			extensions: [".mjs"],
			priority: 0,
			async findNearestConfig() {
				return {
					root: "/srv/repos/fix-headers/src",
					marker: "missing-b.marker"
				};
			},
			parseProjectName() {
				return "deep";
			}
		};

		const detected = await detectProjectFromMarkers("/srv/repos/fix-headers", {
			detectors: [detectorWithoutFinder, shallowDetector, deepDetector],
			preferredExtension: ".mjs"
		});

		expect(detected.language).toBe("deep");
		expect(detected.rootDir).toBe("/srv/repos/fix-headers/src");
		expect(detected.projectName).toBe("deep");
	});

	it("handles non-string preferredExtension and non-finite detector priorities", async () => {
		const lowPriority = {
			id: "low",
			extensions: [".mjs"],
			priority: Number.NaN,
			async findNearestConfig() {
				return {
					root: "/srv/repos/fix-headers",
					marker: "missing-low.marker"
				};
			},
			parseProjectName() {
				return "low";
			}
		};

		const highPriority = {
			id: "high",
			extensions: [".mjs"],
			priority: undefined,
			async findNearestConfig() {
				return {
					root: "/srv/repos/fix-headers",
					marker: "missing-high.marker"
				};
			},
			parseProjectName() {
				return "high";
			}
		};

		const detected = await detectProjectFromMarkers("/srv/repos/fix-headers", {
			detectors: [lowPriority, highPriority],
			preferredExtension: 123
		});

		expect(detected.language).toBe("low");
		expect(detected.projectName).toBe("low");
	});

	it("falls back to project name when located root basename is empty", async () => {
		const rootDetector = {
			id: "root",
			extensions: [".mjs"],
			async findNearestConfig() {
				return {
					root: "/",
					marker: "missing-root.marker"
				};
			},
			parseProjectName(_marker, _content, rootDirName) {
				return rootDirName;
			}
		};

		const detected = await detectProjectFromMarkers("/srv/repos/fix-headers", {
			detectors: [rootDetector],
			preferredExtension: ".mjs"
		});

		expect(detected.projectName).toBe("project");
		expect(detected.rootDir).toBe("/");
	});

	it("uses explicit detector list option", async () => {
		const workspace = await createWorkspace("project-detectors");
		try {
			await writeWorkspaceFile(join(workspace, "package.json"), JSON.stringify({ name: "detector-node" }, null, 2));
			const detected = await detectProjectFromMarkers(workspace, {
				detectors: [nodeDetector]
			});
			expect(detected.language).toBe("node");
			expect(detected.projectName).toBe("detector-node");
		} finally {
			await cleanupWorkspace(workspace);
		}
	});

	it("uses unknown author/email fallback when git identity is unavailable", async () => {
		const workspace = await createWorkspace("project-unknown-author");
		const previousGlobalConfig = process.env.GIT_CONFIG_GLOBAL;
		const previousHome = process.env.HOME;
		try {
			await writeWorkspaceFile(join(workspace, "placeholder.txt"), "x\n");
			process.env.GIT_CONFIG_GLOBAL = join(workspace, "missing-global");
			process.env.HOME = workspace;

			const metadata = await resolveProjectMetadata({
				cwd: workspace,
				enabledDetectors: []
			});
			expect(metadata.authorName).toBe("Unknown Author");
			expect(metadata.authorEmail).toBe("unknown@example.com");
		} finally {
			if (previousGlobalConfig === undefined) {
				delete process.env.GIT_CONFIG_GLOBAL;
			} else {
				process.env.GIT_CONFIG_GLOBAL = previousGlobalConfig;
			}
			if (previousHome === undefined) {
				delete process.env.HOME;
			} else {
				process.env.HOME = previousHome;
			}
			await cleanupWorkspace(workspace);
		}
	});

	it("uses process.cwd fallback when no cwd or targetFilePath is provided", async () => {
		const metadata = await resolveProjectMetadata({
			enabledDetectors: []
		});

		expect(typeof metadata.projectRoot).toBe("string");
		expect(metadata.projectRoot.length).toBeGreaterThan(0);
	});
});
