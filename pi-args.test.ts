import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildPiArgs, type BuildPiArgsInput } from "./pi-args.ts";

function buildArgs(overrides: Partial<BuildPiArgsInput> = {}): string[] {
	return buildPiArgs({
		baseArgs: ["-p"],
		task: "hello",
		sessionEnabled: true,
		...overrides,
	}).args;
}

function getExtensionArgs(args: string[]): string[] {
	const extensions: string[] = [];
	for (let i = 0; i < args.length; i++) {
		if (args[i] === "--extension") {
			const next = args[i + 1];
			if (next) extensions.push(next);
		}
	}
	return extensions;
}

describe("buildPiArgs session wiring", () => {
	it("uses --session when sessionFile is provided", () => {
		const args = buildArgs({
			sessionFile: "/tmp/forked-session.jsonl",
			sessionDir: "/tmp/should-not-be-used",
		});

		assert.ok(args.includes("--session"));
		assert.ok(args.includes("/tmp/forked-session.jsonl"));
		assert.ok(!args.includes("--session-dir"), "--session-dir should not be emitted with --session");
		assert.ok(!args.includes("--no-session"), "--no-session should not be emitted with --session");
	});

	it("keeps fresh mode behavior (sessionDir + no session file)", () => {
		const args = buildArgs({ sessionDir: "/tmp/subagent-sessions" });

		assert.ok(args.includes("--session-dir"));
		assert.ok(args.includes("/tmp/subagent-sessions"));
		assert.ok(!args.includes("--session"));
	});
});

describe("buildPiArgs extension isolation", () => {
	it("disables ambient extensions for subagent runs", () => {
		const args = buildArgs();

		assert.ok(args.includes("--no-extensions"));
		assert.deepEqual(getExtensionArgs(args), []);
	});

	it("preserves explicit extension paths while still disabling ambient ones", () => {
		const args = buildArgs({ extensions: ["/tmp/ext-a.ts", "/tmp/ext-b.ts"] });

		assert.ok(args.includes("--no-extensions"));
		assert.deepEqual(getExtensionArgs(args), ["/tmp/ext-a.ts", "/tmp/ext-b.ts"]);
	});

	it("keeps path-based tool extensions working under isolated extension loading", () => {
		const args = buildArgs({ tools: ["bash", "/tmp/tool-extension.ts"] });

		assert.ok(args.includes("--no-extensions"));
		assert.ok(args.includes("--tools"));
		assert.ok(args.includes("bash"));
		assert.deepEqual(getExtensionArgs(args), ["/tmp/tool-extension.ts"]);
	});
});
