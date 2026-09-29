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

/**
 * @fileoverview YAML detector implementation.
 * @module fix-headers/detectors/yaml
 */

const extensions = [".yaml", ".yml"];

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
	extensions,
	enabledByDefault: true,
	resolveCommentSyntax(filePath) {
		return resolveYamlCommentSyntax(filePath);
	}
};
