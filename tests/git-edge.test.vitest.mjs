import { execFile } from "node:child_process";
import { chmod, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getGitCreationDate, getGitLastModifiedDate } from "../src/utils/git.mjs";
import { cleanupWorkspace, createWorkspace, writeWorkspaceFile } from "./helpers/workspace.mjs";

const execFileAsync = promisify(execFile);

describe("git edge parsing", () => {
	it("returns null for malformed git date output", async () => {
		const workspace = await createWorkspace("git-edge");
		const previousPath = process.env.PATH;

		try {
			await writeWorkspaceFile(join(workspace, "src", "main.mjs"), "export const x = true;\n");
			await execFileAsync("git", ["init"], { cwd: workspace });
			await execFileAsync("git", ["config", "user.name", "Tester"], { cwd: workspace });
			await execFileAsync("git", ["config", "user.email", "tester@example.com"], { cwd: workspace });
			await execFileAsync("git", ["add", "."], { cwd: workspace });
			await execFileAsync("git", ["commit", "-m", "init"], { cwd: workspace });

			const shimPath = join(workspace, "git");
			await writeFile(
				shimPath,
				'#!/usr/bin/env bash\nset -e\nif [[ "$*" == *"--follow"* ]]; then\n  echo "malformed"\n  exit 0\nfi\nif [[ "$*" == *"-1 --format=%aI|%at"* ]]; then\n  echo "2026-01-01T00:00:00Z|not-a-number"\n  exit 0\nfi\nexec /usr/bin/git "$@"\n'
			);
			await chmod(shimPath, 0o755);

			process.env.PATH = `${workspace}:${previousPath}`;

			const created = await getGitCreationDate(workspace, "src/main.mjs");
			const modified = await getGitLastModifiedDate(workspace, "src/main.mjs");

			expect(created).toBeNull();
			expect(modified).toBeNull();
		} finally {
			process.env.PATH = previousPath;
			await cleanupWorkspace(workspace);
		}
	});

	it("returns null for NaN creation timestamp and malformed last-modified split", async () => {
		const workspace = await createWorkspace("git-edge-2");
		const previousPath = process.env.PATH;

		try {
			await writeWorkspaceFile(join(workspace, "src", "main.mjs"), "export const x = true;\n");
			await execFileAsync("git", ["init"], { cwd: workspace });
			await execFileAsync("git", ["config", "user.name", "Tester"], { cwd: workspace });
			await execFileAsync("git", ["config", "user.email", "tester@example.com"], { cwd: workspace });
			await execFileAsync("git", ["add", "."], { cwd: workspace });
			await execFileAsync("git", ["commit", "-m", "init"], { cwd: workspace });

			const shimPath = join(workspace, "git");
			await writeFile(
				shimPath,
				'#!/usr/bin/env bash\nset -e\nif [[ "$*" == *"--follow"* ]]; then\n  echo "2026-01-01T00:00:00Z|not-a-number"\n  exit 0\nfi\nif [[ "$*" == *"-1 --format=%aI|%at"* ]]; then\n  echo "malformed"\n  exit 0\nfi\nexec /usr/bin/git "$@"\n'
			);
			await chmod(shimPath, 0o755);

			process.env.PATH = `${workspace}:${previousPath}`;

			const created = await getGitCreationDate(workspace, "src/main.mjs");
			const modified = await getGitLastModifiedDate(workspace, "src/main.mjs");

			expect(created).toBeNull();
			expect(modified).toBeNull();
		} finally {
			process.env.PATH = previousPath;
			await cleanupWorkspace(workspace);
		}
	});

	it("fills missing email from commit fallback while preserving configured name", async () => {
		const workspace = await createWorkspace("git-edge-partial");
		try {
			await writeWorkspaceFile(join(workspace, "src", "main.mjs"), "export const x = true;\n");
			await execFileAsync("git", ["init"], { cwd: workspace });
			await execFileAsync("git", ["config", "user.name", "Configured Name"], { cwd: workspace });
			await execFileAsync("git", ["config", "user.email", "configured@example.com"], { cwd: workspace });
			await execFileAsync("git", ["add", "."], { cwd: workspace });
			await execFileAsync("git", ["commit", "-m", "init"], { cwd: workspace });

			await execFileAsync("git", ["config", "--unset", "user.email"], { cwd: workspace });
			const { detectGitAuthor } = await import("../src/utils/git.mjs");
			const author = await detectGitAuthor(workspace);
			expect(author.authorName).toBe("Configured Name");
			expect(typeof author.authorEmail).toBe("string");
			expect(author.authorEmail).toContain("@");
		} finally {
			await cleanupWorkspace(workspace);
		}
	});

	it("returns null fallback fields when commit fallback is empty", async () => {
		const workspace = await createWorkspace("git-edge-empty-fallback");
		const previousPath = process.env.PATH;

		try {
			const shimPath = join(workspace, "git");
			await writeFile(
				shimPath,
				'#!/usr/bin/env bash\nset -e\nif [[ "$1" == "config" ]]; then\n  exit 0\nfi\nif [[ "$*" == *"log -1 --format=%an|%ae"* ]]; then\n  echo "|"\n  exit 0\nfi\nexec /usr/bin/git "$@"\n'
			);
			await chmod(shimPath, 0o755);
			process.env.PATH = `${workspace}:${previousPath}`;

			const { detectGitAuthor } = await import("../src/utils/git.mjs");
			const author = await detectGitAuthor(workspace);
			expect(author.authorName).toBeNull();
			expect(author.authorEmail).toBeNull();
		} finally {
			process.env.PATH = previousPath;
			await cleanupWorkspace(workspace);
		}
	});
});
