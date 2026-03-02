import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { detector as cssDetector } from "../src/detectors/css.mjs";
import { detector as goDetector } from "../src/detectors/go.mjs";
import { detector as htmlDetector } from "../src/detectors/html.mjs";
import { detector as nodeDetector } from "../src/detectors/node.mjs";
import { detector as phpDetector } from "../src/detectors/php.mjs";
import { detector as pythonDetector } from "../src/detectors/python.mjs";
import { detector as rustDetector } from "../src/detectors/rust.mjs";
import { getCommentSyntaxForFile, getDetectorById } from "../src/detectors/index.mjs";
import { cleanupWorkspace, createWorkspace, writeWorkspaceFile } from "./helpers/workspace.mjs";

describe("detector implementations", () => {
	it("covers detector parse and comment syntax branches", () => {
		expect(nodeDetector.parseProjectName("package.json", JSON.stringify({ name: "det-node" }), "fallback")).toBe("det-node");
		expect(nodeDetector.parseProjectName("package.json", JSON.stringify({ name: "   " }), "fallback")).toBe("fallback");
		expect(nodeDetector.parseProjectName("package.json", "{", "fallback")).toBe("fallback");
		expect(nodeDetector.resolveCommentSyntax("/repo/src/file.mjs")?.kind).toBe("block");
		expect(nodeDetector.resolveCommentSyntax("/repo/src/file.css")).toBeNull();

		expect(goDetector.parseProjectName("go.mod", "module github.com/demo/pkg", "fallback")).toBe("github.com/demo/pkg");
		expect(goDetector.parseProjectName("go.mod", "module    ", "fallback")).toBe("fallback");
		expect(goDetector.resolveCommentSyntax("/repo/main.go")?.kind).toBe("block");
		expect(goDetector.resolveCommentSyntax("/repo/main.rs")).toBeNull();

		expect(phpDetector.parseProjectName("composer.json", JSON.stringify({ name: "vendor/package" }), "fallback")).toBe("vendor/package");
		expect(phpDetector.parseProjectName("composer.json", JSON.stringify({}), "fallback")).toBe("fallback");
		expect(phpDetector.parseProjectName("composer.json", "{", "fallback")).toBe("fallback");
		expect(phpDetector.resolveCommentSyntax("/repo/file.php")?.kind).toBe("block");
		expect(phpDetector.resolveCommentSyntax("/repo/file.py")).toBeNull();

		expect(pythonDetector.parseProjectName("pyproject.toml", 'name = "demo-py"', "fallback")).toBe("demo-py");
		expect(pythonDetector.parseProjectName("pyproject.toml", 'version = "1.0.0"', "fallback")).toBe("fallback");
		expect(pythonDetector.resolveCommentSyntax("/repo/app.py")?.kind).toBe("line");
		expect(pythonDetector.resolveCommentSyntax("/repo/app.php")).toBeNull();

		expect(rustDetector.parseProjectName("Cargo.toml", 'name = "demo-rs"', "fallback")).toBe("demo-rs");
		expect(rustDetector.parseProjectName("Cargo.toml", 'edition = "2021"', "fallback")).toBe("fallback");
		expect(rustDetector.resolveCommentSyntax("/repo/src/lib.rs")?.kind).toBe("block");
		expect(rustDetector.resolveCommentSyntax("/repo/src/lib.go")).toBeNull();

		expect(cssDetector.parseProjectName("package.json", "", "fallback")).toBe("fallback");
		expect(cssDetector.resolveCommentSyntax("/repo/styles/main.css")?.kind).toBe("block");
		expect(cssDetector.resolveCommentSyntax("/repo/styles/main.scss")).toBeNull();

		expect(htmlDetector.parseProjectName("index.html", "", "fallback")).toBe("fallback");
		expect(htmlDetector.resolveCommentSyntax("/repo/index.html")?.kind).toBe("html");
		expect(htmlDetector.resolveCommentSyntax("/repo/index.md")).toBeNull();
	});

	it("covers detector findNearestConfig methods and registry helpers", async () => {
		const workspace = await createWorkspace("detector-find-config");

		try {
			await writeWorkspaceFile(join(workspace, "package.json"), JSON.stringify({ name: "detector-find" }, null, 2));
			await writeWorkspaceFile(join(workspace, "postcss.config.js"), "export default {};\n");
			await writeWorkspaceFile(join(workspace, "go.mod"), "module github.com/example/find\n");
			await writeWorkspaceFile(join(workspace, "composer.json"), JSON.stringify({ name: "example/php" }, null, 2));
			await writeWorkspaceFile(join(workspace, "Cargo.toml"), '[package]\nname="example-rust"\n');
			await writeWorkspaceFile(join(workspace, "pyproject.toml"), 'name = "example-py"\n');
			await writeWorkspaceFile(join(workspace, "index.html"), "<!doctype html>\n");

			expect(await nodeDetector.findNearestConfig(workspace)).not.toBeNull();
			expect(await cssDetector.findNearestConfig(workspace)).not.toBeNull();
			expect(await goDetector.findNearestConfig(workspace)).not.toBeNull();
			expect(await phpDetector.findNearestConfig(workspace)).not.toBeNull();
			expect(await rustDetector.findNearestConfig(workspace)).not.toBeNull();
			expect(await pythonDetector.findNearestConfig(workspace)).not.toBeNull();
			expect(await htmlDetector.findNearestConfig(workspace)).not.toBeNull();

			expect(getDetectorById("node")?.id).toBe("node");
			expect(getDetectorById("unknown-detector")).toBeUndefined();

			const blockSyntax = getCommentSyntaxForFile("/repo/src/file.mjs", {
				detectorSyntaxOverrides: {
					node: {
						blockStart: "/*",
						blockLinePrefix: " * ",
						blockEnd: " */"
					}
				}
			});
			expect(blockSyntax.blockStart).toBe("/*");

			const lineSyntax = getCommentSyntaxForFile("/repo/src/file.py", {
				detectorSyntaxOverrides: {
					python: {
						linePrefix: ";;"
					}
				}
			});
			expect(lineSyntax.linePrefix).toBe(";;");

			const lineFallbackSyntax = getCommentSyntaxForFile("/repo/src/file.py", {
				detectorSyntaxOverrides: {
					python: {
						linePrefix: ""
					}
				}
			});
			expect(lineFallbackSyntax.linePrefix).toBe("#");

			const blockFallbackSyntax = getCommentSyntaxForFile("/repo/src/file.mjs", {
				detectorSyntaxOverrides: {
					node: {
						blockStart: "",
						blockLinePrefix: 123,
						blockEnd: ""
					}
				}
			});
			expect(blockFallbackSyntax.blockStart).toBe("/**");
			expect(blockFallbackSyntax.blockLinePrefix).toBe(" *\t");
			expect(blockFallbackSyntax.blockEnd).toBe(" */");

			const ignoredOverrides = getCommentSyntaxForFile("/repo/src/file.mjs", {
				detectorSyntaxOverrides: "invalid"
			});
			expect(ignoredOverrides.blockStart).toBe("/**");

			const fallbackSyntax = getCommentSyntaxForFile("/repo/src/file.unknown");
			expect(fallbackSyntax.kind).toBe("block");
		} finally {
			await cleanupWorkspace(workspace);
		}
	});
});
