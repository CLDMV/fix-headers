/**
 *	@Project: @cldmv/fix-headers
 *	@Filename: /src/detectors/html.mjs
 *	@Date: 2026-03-01T17:59:32-08:00 (1772416772)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-01T17:59:32-08:00 (1772416772)
 *	-----
 *	@Copyright: Copyright (c) 2026-2026 Catalyzed Motivation Inc. All rights reserved.
 */
export declare const detector: {
    id: string;
    priority: number;
    markers: string[];
    extensions: string[];
    enabledByDefault: boolean;
    findNearestConfig(startPath: any): Promise<{
        root: string;
        marker: string;
    }>;
    parseProjectName(_marker: any, _markerContent: any, rootDirName: any): string;
    resolveCommentSyntax(filePath: any): {
        kind: "html";
        blockStart: string;
        blockLinePrefix: string;
        blockEnd: string;
    };
};
