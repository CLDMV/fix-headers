/**
 *	@Project: @cldmv/fix-headers
 *	@Filename: /tests/detectors.test.vitest.mjs
 *	@Date: 2026-03-01T17:59:32-08:00 (1772416772)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-04 21:00:18 -08:00 (1772686818)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

import { describe, expect, it } from "vitest";
import { detector as cssDetector } from "../src/detectors/css.mjs";
import { detector as goDetector } from "../src/detectors/go.mjs";
import { detector as htmlDetector } from "../src/detectors/html.mjs";
import { detector as jsonDetector } from "../src/detectors/json.mjs";
import { detector as nodeDetector } from "../src/detectors/node.mjs";
import { detector as phpDetector } from "../src/detectors/php.mjs";
import { detector as pythonDetector } from "../src/detectors/python.mjs";
import { detector as rustDetector } from "../src/detectors/rust.mjs";
import { detector as yamlDetector } from "../src/detectors/yaml.mjs";
import { getCommentSyntaxForFile, getDetectorById, getPreservedPrefixForFile } from "../src/detectors/index.mjs";

describe("detector implementations", () => {
	it("covers detector comment syntax branches", () => {
		expect(nodeDetector.resolveCommentSyntax("/repo/src/file.mjs")?.kind).toBe("block");
		expect(nodeDetector.resolveCommentSyntax("/repo/src/file.jsonc")).toBeNull();
		expect(nodeDetector.resolveCommentSyntax("/repo/src/file.css")).toBeNull();

		expect(jsonDetector.resolveCommentSyntax("/repo/src/file.jsonc")?.kind).toBe("block");
		expect(jsonDetector.resolveCommentSyntax("/repo/src/file.mjs")).toBeNull();

		expect(goDetector.resolveCommentSyntax("/repo/main.go")?.kind).toBe("block");
		expect(goDetector.resolveCommentSyntax("/repo/main.rs")).toBeNull();

		expect(phpDetector.resolveCommentSyntax("/repo/file.php")?.kind).toBe("block");
		expect(phpDetector.resolveCommentSyntax("/repo/file.py")).toBeNull();

		expect(pythonDetector.resolveCommentSyntax("/repo/app.py")?.kind).toBe("line");
		expect(pythonDetector.resolveCommentSyntax("/repo/app.php")).toBeNull();

		expect(rustDetector.resolveCommentSyntax("/repo/src/lib.rs")?.kind).toBe("block");
		expect(rustDetector.resolveCommentSyntax("/repo/src/lib.go")).toBeNull();

		expect(cssDetector.resolveCommentSyntax("/repo/styles/main.css")?.kind).toBe("block");
		expect(cssDetector.resolveCommentSyntax("/repo/styles/main.scss")).toBeNull();

		expect(htmlDetector.resolveCommentSyntax("/repo/index.html")?.kind).toBe("html");
		expect(htmlDetector.resolveCommentSyntax("/repo/index.md")).toBeNull();

		expect(yamlDetector.resolveCommentSyntax("/repo/config/app.yaml")?.kind).toBe("line");
		expect(yamlDetector.resolveCommentSyntax("/repo/config/app.yaml")?.linePrefix).toBe("#");
		expect(yamlDetector.resolveCommentSyntax("/repo/config/app.yml")?.kind).toBe("line");
		expect(yamlDetector.resolveCommentSyntax("/repo/config/app.toml")).toBeNull();
	});

	it("covers the detector registry helpers", () => {
		expect(getDetectorById("node")?.id).toBe("node");
		expect(getDetectorById("json")?.id).toBe("json");
		expect(getDetectorById("yaml")?.id).toBe("yaml");
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
					linePrefix: ";;",
					lineSeparator: " "
				}
			}
		});
		expect(lineSyntax.linePrefix).toBe(";;");
		expect(lineSyntax.lineSeparator).toBe(" ");

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

		expect(getPreservedPrefixForFile("/repo/src/cli.mjs", "#!/usr/bin/env node\nconsole.log('x')\n")).toBe("#!/usr/bin/env node\n");
		expect(getPreservedPrefixForFile("/repo/src/app.py", "#!/usr/bin/env python3\nprint('x')\n")).toBe("#!/usr/bin/env python3\n");
		expect(getPreservedPrefixForFile("/repo/src/file.unknown", "#!/usr/bin/env custom\nvalue\n")).toBe("");
	});
});
