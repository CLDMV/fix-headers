/**
 *	@Project: @cldmv/fix-headers
 *	@Filename: /src/detectors/rust.mjs
 *	@Date: 2026-03-01T17:59:32-08:00 (1772416772)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-01T17:59:32-08:00 (1772416772)
 *	-----
 *	@Copyright: Copyright (c) 2026-2026 Catalyzed Motivation Inc. All rights reserved.
 */

import { extname } from "node:path";
import { findNearestMarker } from "./shared.mjs";

/**
 * @fileoverview Rust detector implementation.
 * @module fix-headers/detectors/rust
 */

const markers = ["Cargo.toml"];
const extensions = [".rs"];

/**
 * Resolves Rust comment syntax.
 * @param {string} filePath - File path.
 * @returns {{kind: "block", blockStart: string, blockLinePrefix: string, blockEnd: string} | null} Syntax descriptor.
 */
function resolveRustCommentSyntax(filePath) {
	const extension = extname(filePath).toLowerCase();
	if (extensions.includes(extension)) {
		return {
			kind: "block",
			blockStart: "/**",
			blockLinePrefix: " *\t",
			blockEnd: " */"
		};
	}
	return null;
}

export const detector = {
	id: "rust",
	priority: 80,
	markers,
	extensions,
	enabledByDefault: true,
	findNearestConfig(startPath) {
		return findNearestMarker(startPath, markers);
	},
	parseProjectName(_marker, markerContent, rootDirName) {
		const cargoNameMatch = markerContent.match(/^name\s*=\s*["']([^"']+)["']/m);
		if (cargoNameMatch?.[1]) {
			return cargoNameMatch[1];
		}
		return rootDirName;
	},
	resolveCommentSyntax(filePath) {
		return resolveRustCommentSyntax(filePath);
	}
};
