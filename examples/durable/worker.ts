import { BACKGROUND_CONTEXT } from "@earendil-works/chord/context";
import { createModels } from "@earendil-works/pi-ai/models";
import {
	createRegistry, defineDoc, defineExtension, Harness, type TaskId,
} from "@earendil-works/pi-durable";
import { openNodeSqliteStorage } from "@earendil-works/pi-durable/storage/sqlite/node";
import { Counter } from "./counter.ts";

const Run = defineDoc<{ taskId: TaskId<number> | null }>({
	kind: "example.counter-run",
	version: 1,
	scope: "session",
	initial: () => ({ taskId: null }),
});

const databasePath = process.argv[2];
if (!databasePath) throw new Error("Supply an isolated SQLite path");
const context = BACKGROUND_CONTEXT;
const registry = createRegistry();
registry.install(defineExtension({ name: "counter-v1", tasks: [Counter] }));
const harness = await Harness.open(
	await openNodeSqliteStorage(databasePath),
	{ models: createModels(), registry },
	context,
);

try {
	const root = await harness.root(context);
	// Durable admission: reopening finds the existing task, even if the
	// original caller died before receiving its ID. Scoped demo, one run.
	const id = await root.commit(async (tx) => {
		const run = await tx.doc(Run);
		if (run.taskId === null) {
			run.taskId = await tx.createTask(
				Counter, { to: 5 }, { ownership: { kind: "conversation" } },
			);
		}
		return run.taskId;
	}, context);
	console.log(`task ${id}`);
	console.log("saved", JSON.stringify((await harness.getTask(id, context))?.state));
	if (process.argv[3] === "--abort") {
		await harness.abortTask(id, context);
	}
	const settled = await harness.waitForTask(id, context);
	console.log("outcome", JSON.stringify(settled.state.outcome));
} finally {
	await harness.close(context);
}
