import { relative } from "node:path";
import { getHeaderSyntaxForFile, renderHeaderLines } from "./syntax.mjs";

/**
 * @fileoverview Header template builder used to generate normalized file headers.
 * @module fix-headers/header/template
 */

/**
 * Builds a normalized header block for a source file.
 * @param {{
 *  absoluteFilePath: string,
 *  language?: string,
 *  syntaxOptions?: { language?: string, enabledDetectors?: string[], disabledDetectors?: string[], detectorSyntaxOverrides?: Record<string, { linePrefix?: string, blockStart?: string, blockLinePrefix?: string, blockEnd?: string }> },
 *  projectRoot: string,
 *  projectName: string,
 *  authorName: string,
 *  authorEmail: string,
 *  createdAt: {date: string, timestamp: number},
 *  lastModifiedAt: {date: string, timestamp: number},
 *  copyrightStartYear: number,
 *  companyName: string,
 *  currentYear: number
 * }} data - Header data.
 * @returns {string} Header block text.
 */
export function buildHeader(data) {
	const relativePath = `/${relative(data.projectRoot, data.absoluteFilePath).replace(/\\/g, "/")}`;
	const syntax = getHeaderSyntaxForFile(data.absoluteFilePath, data.syntaxOptions || { language: data.language });
	const headerLines = [
		`@Project: ${data.projectName}`,
		`@Filename: ${relativePath}`,
		`@Date: ${data.createdAt.date} (${data.createdAt.timestamp})`,
		`@Author: ${data.authorName}`,
		`@Email: <${data.authorEmail}>`,
		"-----",
		`@Last modified by: ${data.authorName} (${data.authorEmail})`,
		`@Last modified time: ${data.lastModifiedAt.date} (${data.lastModifiedAt.timestamp})`,
		"-----",
		`@Copyright: Copyright (c) ${data.copyrightStartYear}-${data.currentYear} ${data.companyName}. All rights reserved.`
	];

	return renderHeaderLines(syntax, headerLines);
}
