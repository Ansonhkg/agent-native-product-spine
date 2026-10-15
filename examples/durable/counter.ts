import { defineTask } from "@earendil-works/pi-durable";

// The version is part of the name so a later definition cannot replace
// this run's code merely by registering the same task kind.
export const Counter = defineTask<
	{ to: number },
	{ phase: "count"; completed: number },
	number
>({
	name: "example.counter.v1",
	version: 1,
	initial: () => ({ phase: "count", completed: 0 }),
	phases: {
		count: async (task, runtime, context) => {
			// Pure computation is safe to repeat if this phase is interrupted.
			const completed = task.state.checkpoint.completed + 1;
			await runtime.commit(
				() => completed >= task.input.to
					? {
						status: "terminal",
						outcome: { status: "completed", result: completed },
					}
					: {
						status: "running",
						checkpoint: { phase: "count", completed },
					},
				context,
			);
			// Diagnostic output follows the commit; it is not a durable journal.
			console.log(`committed ${completed}`);
			if (completed < task.input.to) {
				await runtime.sleep(runtime.now() + 500, context);
			}
		},
	},
	abort: async (_task, runtime, context) => {
		await runtime.commit(
			() => ({ status: "terminal", outcome: { status: "aborted" } }),
			context,
		);
	},
});
