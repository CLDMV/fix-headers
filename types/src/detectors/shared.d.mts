/**
 * @fileoverview Shared detector helpers for nearest marker search.
 * @module fix-headers/detectors/shared
 */
/**
 * Finds the closest marker file by walking up parent directories.
 * @param {string} startPath - Starting directory or file path.
 * @param {string[]} markers - Marker filenames to search.
 * @returns {Promise<{root: string, marker: string} | null>} Closest located marker.
 */
export function findNearestMarker(startPath: string, markers: string[]): Promise<{
    root: string;
    marker: string;
} | null>;
