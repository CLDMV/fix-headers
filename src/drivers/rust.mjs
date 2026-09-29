/**
 *	@Project: @cldmv/fix-headers
 *	@Filename: /src/drivers/rust.mjs
 *	@Date: 2026-09-28T19:20:00-07:00 (1790648400)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-09-28T19:20:00-07:00 (1790648400)
 *	-----
 *	@Copyright: Copyright (c) 2026-2026 Catalyzed Motivation Inc. All rights reserved.
 */

import { detectManifests, readTomlAuthor, readTomlString } from "./shared.mjs";

/**
 * @fileoverview Rust manifest driver: `Cargo.toml` (`[package].name`, and the name part of
 * `[package].authors[0]` as the copyright holder). A workspace-only `Cargo.toml` has no
 * `[package]` table and so provides neither.
 * @module fix-headers/drivers/rust
 */

const manifests = ["Cargo.toml"];

/** @type {import("./index.mjs").ManifestDriver} */
export const driver = {
	id: "rust",
	languages: ["rust"],
	manifests,
	detect(dirPath) {
		return detectManifests(dirPath, manifests);
	},
	read(detection) {
		const content = detection.files[0].content;
		return { name: readTomlString(content, "package", "name"), company: readTomlAuthor(content, "package") };
	}
};
