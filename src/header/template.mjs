/**
 *	@Project: @cldmv/fix-headers
 *	@Filename: /src/header/template.mjs
 *	@Date: 2026-03-01T17:59:32-08:00 (1772416772)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-01T17:59:32-08:00 (1772416772)
 *	-----
 *	@Copyright: Copyright (c) 2026-2026 Catalyzed Motivation Inc. All rights reserved.
 */

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
 *  syntaxOptions?: { language?: string, enabledDetectors?: string[], disabledDetectors?: string[], detectorSyntaxOverrides?: Record<string, { linePrefix?: string, lineSeparator?: string, blockStart?: string, blockLinePrefix?: string, blockEnd?: string }> },
 *  projectRoot: string,
 *  createdByName?: string,
 *  createdByEmail?: string,
 *  lastModifiedByName?: string,
 *  lastModifiedByEmail?: string,
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
	const createdByName = data.createdByName || data.authorName;
	const createdByEmail = data.createdByEmail || data.authorEmail;
	const lastModifiedByName = data.lastModifiedByName || data.authorName;
	const lastModifiedByEmail = data.lastModifiedByEmail || data.authorEmail;
	const headerLines = [
		`@Project: ${data.projectName}`,
		`@Filename: ${relativePath}`,
		`@Date: ${data.createdAt.date} (${data.createdAt.timestamp})`,
		`@Author: ${createdByName}`,
		`@Email: <${createdByEmail}>`,
		"-----",
		`@Last modified by: ${lastModifiedByName} (${lastModifiedByEmail})`,
		`@Last modified time: ${data.lastModifiedAt.date} (${data.lastModifiedAt.timestamp})`,
		"-----",
		`@Copyright: Copyright (c) ${data.copyrightStartYear}-${data.currentYear} ${data.companyName} All rights reserved.`
	];

	return renderHeaderLines(syntax, headerLines);
}
