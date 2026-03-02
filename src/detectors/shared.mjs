import { dirname, join, resolve } from "node:path";
import { pathExists } from "../utils/fs.mjs";

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
export async function findNearestMarker(startPath, markers) {
	let currentDir = resolve(startPath);

	while (true) {
		for (const marker of markers) {
			const markerPath = join(currentDir, marker);
			if (await pathExists(markerPath)) {
				return { root: currentDir, marker };
			}
		}

		const parent = dirname(currentDir);
		if (parent === currentDir) {
			return null;
		}
		currentDir = parent;
	}
}
