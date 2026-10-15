import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repository = process.argv[2]; // Optional Pi source checkout for local verification.
const directory = await mkdtemp(join(tmpdir(), "pi-durable-doc-check-"));
const database = join(directory, "session.sqlite");
const worker = fileURLToPath(new URL("./worker.ts", import.meta.url));
const run = (interrupt) => new Promise((resolve, reject) => {
	const preload = repository
		? ["--import", join(repository, "packages/coding-agent/src/experimental/source-resolver.ts")]
		: [];
	const child = spawn(process.execPath, [...preload, worker, database], {
		cwd: repository ?? dirname(worker),
	});
	let output = "";
	let errors = "";
	let killed = false;
	const timeout = setTimeout(() => {
		child.kill("SIGKILL");
		reject(new Error("Timed out"));
	}, 20000);
	child.stdout.on("data", (chunk) => {
		output += chunk;
		if (interrupt && !killed && output.includes("committed 2\n")) {
			killed = true;
			child.kill("SIGKILL");
		}
	});
	child.stderr.on("data", (chunk) => { errors += chunk; });
	child.on("error", (error) => { clearTimeout(timeout); reject(error); });
	child.on("close", (code, signal) => {
		clearTimeout(timeout);
		if (interrupt ? signal !== "SIGKILL" : code !== 0) {
			reject(new Error(`Unexpected exit ${code}/${signal}: ${errors}`));
		} else resolve(output);
	});
});

try {
	const first = await run(true);
	const resumed = await run(false);
	const reopened = await run(false);
	const taskId = first.match(/^task (\d+)$/m)?.[1];
	assert.ok(taskId);
	assert.match(resumed, new RegExp(`^task ${taskId}$`, "m"));
	assert.match(resumed, /"completed":2/);
	assert.deepEqual([...resumed.matchAll(/^committed (\d+)$/gm)].map((m) => Number(m[1])), [3, 4, 5]);
	assert.match(resumed, /outcome \{"status":"completed","result":5\}/);
	assert.match(reopened, new RegExp(`^task ${taskId}$`, "m"));
	assert.doesNotMatch(reopened, /^committed /m);
	console.log("PASS: SIGKILL after checkpoint 2; same task resumed at 3 and completed at 5.");
	console.log("PASS: reopening a completed task executes no phases.");
	console.log("FIRST PROCESS\n" + first + "RESUMED PROCESS\n" + resumed);
} finally {
	await rm(directory, { recursive: true, force: true });
}
