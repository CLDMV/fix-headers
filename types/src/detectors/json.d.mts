export namespace detector {
    export let id: string;
    export let priority: number;
    export { markers };
    export { extensions };
    export let enabledByDefault: boolean;
    export function findNearestConfig(startPath: any): Promise<{
        root: string;
        marker: string;
    }>;
    export function parseProjectName(_marker: any, markerContent: any, rootDirName: any): string;
    export function resolveCommentSyntax(filePath: any): {
        kind: "block";
        blockStart: string;
        blockLinePrefix: string;
        blockEnd: string;
    };
}
/**
 * @fileoverview JSON-family detector implementation.
 * @module fix-headers/detectors/json
 */
declare const markers: string[];
declare const extensions: string[];
export {};
