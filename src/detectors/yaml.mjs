/**
 *	@Project: @cldmv/fix-headers
 *	@Filename: /src/detectors/yaml.mjs
 *	@Date: 2026-03-01 18:28:31 -08:00 (1772418511)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-01 19:32:27 -08:00 (1772422347)
 *	-----
 *	@Copyright: Copyright (c) 2026-2026 Catalyzed Motivation Inc. All rights reserved.
 */

import { extname } from "node:path";
import { findNearestMarker } from "./shared.mjs";

/**
 * @fileoverview YAML detector implementation.
 * @module fix-headers/detectors/yaml
 */

const markers = ["package.json", ".git"];
const extensions = [".yaml", ".yml"];

/**
 * Parses YAML project name from nearest marker content when available.
 * @param {string} marker - Marker filename.
 * @param {string} markerContent - Marker content.
 * @param {string} rootDirName - Fallback root directory name.
 * @returns {string} Project name.
 */
function parseYamlProjectName(marker, markerContent, rootDirName) {
	if (marker !== "package.json") {
		return rootDirName;
	}

	try {
		const parsed = JSON.parse(markerContent);
		if (typeof parsed.name === "string" && parsed.name.trim().length > 0) {
			return parsed.name.trim();
		}
		return rootDirName;
	} catch {
		return rootDirName;
	}
}

/**
 * Resolves comment syntax for YAML file extensions.
 * @param {string} filePath - File path.
 * @returns {{kind: "line", linePrefix: string} | null} Syntax descriptor.
 */
function resolveYamlCommentSyntax(filePath) {
	const extension = extname(filePath).toLowerCase();
	if (extensions.includes(extension)) {
		return {
			kind: "line",
			linePrefix: "#"
		};
	}
	return null;
}

export const detector = {
	id: "yaml",
	priority: 60,
	markers,
	extensions,
	enabledByDefault: true,
	findNearestConfig(startPath) {
		return findNearestMarker(startPath, markers);
	},
	parseProjectName(marker, markerContent, rootDirName) {
		return parseYamlProjectName(marker, markerContent, rootDirName);
	},
	resolveCommentSyntax(filePath) {
		return resolveYamlCommentSyntax(filePath);
	}
};
