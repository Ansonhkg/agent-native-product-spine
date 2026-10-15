# Durable recovery example

This is a standalone checkpointing example, not a complete application integration. It makes no model calls. `counter.ts` defines the versioned task; `worker.ts` persists one demo run's identity in SQLite and reopens it on later invocations.

## Requirements

Use a Node version supported by the selected Pi packages, with native TypeScript support. Install exact, verified versions of `@earendil-works/pi-durable`, `@earendil-works/pi-ai`, and `@earendil-works/chord` in the adopting app using its reviewed dependency process. Check code against the installed API types; the durable API is experimental. SQLite is the example adapter, not a mandated application database. Enforce one worker per storage path.

## Start, restart and abort

From the adopting app root:

```sh
node examples/durable/worker.ts /absolute/isolated/session.sqlite
```

Kill that worker after `committed 2`, then run the same command. It should print the same task ID and saved checkpoint 2, then commit 3, 4 and 5. A third invocation should return the completed outcome without executing more phases. Printed logs are diagnostic and are not an audit journal.

To explicitly abort a pending run instead of recovering it:

```sh
node examples/durable/worker.ts /absolute/isolated/session.sqlite --abort
```

The abort records an aborted outcome. Do not start concurrent workers or reuse a completed database when demonstrating pending-work abort.

## Automated verification

```sh
node examples/durable/verify.mjs
```

The verifier creates temporary SQLite storage, kills its own child process after checkpoint 2, and asserts same-task recovery at 3, completion at 5, and no phase execution on reopening a completed task. It removes only its own temporary storage. A 20-second timeout bounds each child run.

For a hydrated Pi source checkout, pass its absolute path:

```sh
node examples/durable/verify.mjs /absolute/path/to/pi
```

This optionally preloads the checkout's source resolver. Dependencies must already be installed; the verifier does not install packages or call provider APIs.

## Evidence boundary

This verifies only its asserted checkpoint/recovery behavior when actually run successfully. It does not prove authorization, conflicting admission handling, external-effect idempotency, UI updates, abort cleanup, or application integration. Test those in the adopting app's conformance suite. Syntax checking alone is not recovery verification.
