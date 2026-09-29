/**
 *	@Project: @cldmv/fix-headers
 *	@Filename: /src/detectors/json.mjs
 *	@Date: 2026-03-01 20:00:00 -08:00 (1772433600)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-01 20:00:00 -08:00 (1772433600)
 *	-----
 *	@Copyright: Copyright (c) 2026-2026 Catalyzed Motivation Inc. All rights reserved.
 */
export declare const detector: {
    id: string;
    extensions: string[];
    enabledByDefault: boolean;
    resolveCommentSyntax(filePath: any): {
        kind: "block";
        blockStart: string;
        blockLinePrefix: string;
        blockEnd: string;
    };
};
