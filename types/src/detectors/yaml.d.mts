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
    export function parseProjectName(marker: any, markerContent: any, rootDirName: any): string;
    export function resolveCommentSyntax(filePath: any): {
        kind: "line";
        linePrefix: string;
    };
}
/**
 * @fileoverview YAML detector implementation.
 * @module fix-headers/detectors/yaml
 */
declare const markers: string[];
declare const extensions: string[];
export {};
