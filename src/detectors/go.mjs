import { extname } from "node:path";
import { findNearestMarker } from "./shared.mjs";

/**
 * @fileoverview Go detector implementation.
 * @module fix-headers/detectors/go
 */

const markers = ["go.mod"];
const extensions = [".go"];

/**
 * Resolves Go comment syntax.
 * @param {string} filePath - File path.
 * @returns {{kind: "block", blockStart: string, blockLinePrefix: string, blockEnd: string} | null} Syntax descriptor.
 */
function resolveGoCommentSyntax(filePath) {
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
	id: "go",
	priority: 80,
	markers,
	extensions,
	enabledByDefault: true,
	findNearestConfig(startPath) {
		return findNearestMarker(startPath, markers);
	},
	parseProjectName(_marker, markerContent, rootDirName) {
		const moduleMatch = markerContent.match(/^module\s+(.+)$/m);
		if (moduleMatch?.[1]) {
			const value = moduleMatch[1].trim();
			if (value.length > 0) {
				return value;
			}
		}
		return rootDirName;
	},
	resolveCommentSyntax(filePath) {
		return resolveGoCommentSyntax(filePath);
	}
};
