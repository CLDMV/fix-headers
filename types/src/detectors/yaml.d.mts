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
    parseProjectName(marker: any, markerContent: any, rootDirName: any): string;
    resolveCommentSyntax(filePath: any): {
        kind: "line";
        linePrefix: string;
    };
};
