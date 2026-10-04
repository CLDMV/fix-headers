/**
 *
 *	@Project: @cldmv/fix-headers
 *	@Filename: /src/detectors/markdown.mjs
 *	@Date: 2026-10-03T17:04:18-07:00 (1791072258)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-03T17:08:31-07:00 (1791072511)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

import { extname } from "node:path";

/**
 * @fileoverview Markdown detector implementation. Force-only: Markdown files get a header
 * only when this detector is named in `forcedDetectors` (CLI `--force-detector markdown`),
 * and then as an HTML comment, which Markdown renderers do not display.
 * @module fix-headers/detectors/markdown
 */

// `.mdx` is left out on purpose: MDX 2 rejects HTML comments.
const extensions = [".md", ".markdown"];

/**
 * Resolves HTML comment syntax for Markdown files.
 * @param {string} filePath - File path.
 * @returns {{kind: "html", blockStart: string, blockLinePrefix: string, blockEnd: string} | null} Syntax descriptor.
 */
function resolveMarkdownCommentSyntax(filePath) {
	const extension = extname(filePath).toLowerCase();
	if (extensions.includes(extension)) {
		return {
			kind: "html",
			blockStart: "<!--",
			blockLinePrefix: "\t",
			blockEnd: "-->"
		};
	}
	return null;
}

/**
 * Resolves the YAML front matter block (`---` … `---`) at the top of a Markdown file, which
 * has to stay first for static site generators to read it.
 * @param {string} _filePath - File path.
 * @param {string} content - File content.
 * @returns {string} Preserved prefix.
 */
function resolveMarkdownPreservedPrefix(_filePath, content) {
	const frontMatterMatch = content.match(/^---\r?\n[\s\S]*?\r?\n---[ \t]*(?:\r?\n|$)/);
	return frontMatterMatch ? frontMatterMatch[0] : "";
}

export const detector = {
	id: "markdown",
	extensions,
	enabledByDefault: false,
	requiresForce: true,
	resolvePreservedPrefix(filePath, content) {
		return resolveMarkdownPreservedPrefix(filePath, content);
	},
	resolveCommentSyntax(filePath) {
		return resolveMarkdownCommentSyntax(filePath);
	}
};
