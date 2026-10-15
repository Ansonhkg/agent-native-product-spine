# Workspace Tasks

A runnable local task manager built from the bundled architecture skill. Select Personal or Work explicitly, then list, create, complete, reopen, or delete tasks.

> This example was built before rule ARCH-014 was added. It still selects views with `?workspace=`, `?q=`, `?surface=` and `#` anchors. New apps should use slash-separated paths, as ARCH-014 describes.

## Run

Requires Node 22.13+ and Python 3. Node's SQLite module is experimental in Node 22.

```sh
npm ci
npm run build
npm start
```

Open http://127.0.0.1:4347. Dark mode and list layout are defaults. Theme and layout survive refresh. Workspace is in the URL. Enter creates, Escape cancels a draft or dialog, Command K selects the workspace, Command N focuses the new-task field.

## Interfaces

```sh
npm run cli -- list --workspace personal
npm run cli -- create --workspace personal --title "Plan tomorrow"
npm run cli -- setCompleted --workspace personal --id TASK_UUID --completed true
npm run cli -- setCompleted --workspace personal --id TASK_UUID --completed false
npm run cli -- delete --workspace personal --id TASK_UUID
```

CLI fetches the current revision unless `--revision` is supplied. Use `--key` to retry a lost response with the original input and revision. Automatic mutation retries are disabled.

HTTP uses POST `/api/tasks/list`, `/api/tasks/create`, `/api/tasks/setCompleted`, and `/api/tasks/delete`. Supply `Authorization: Bearer <contents of data/owner.token>`. List input is `{"workspace":"personal"}`. Mutations also require integer `revision` and string `key`. Create adds `title`; completion adds `id` and boolean `completed`; deletion adds `id`. Unknown fields are rejected. Results are `{ok:true,value:{workspace,revision,tasks}}` or `{ok:false,error:{code,message}}`. GET `/api/discover?workspace=personal` filters operations by host grants.

MCP uses the standard SDK stdio transport:

```sh
TASKS_WORKSPACE=personal npm run mcp
```

Configure the MCP client to execute `node --import tsx src/mcp.ts` with this folder as its working directory and `TASKS_WORKSPACE=personal`. Tools are `tasks_list`, `tasks_create`, `tasks_setCompleted`, and `tasks_delete`. Mutations use the same HTTP input. MCP requires its input workspace to match the explicitly configured discovery scope. `TASKS_URL`, `TASKS_DATA`, and `TASKS_TOKEN` configure adapters. Tool discovery is permission filtered, and the host rechecks authorization on every call.

## Architecture

The HTTP host binds only loopback. Effect 4.0.0-beta.107 runs one typed `TaskService` behind the shared executor. Zod validates input, output, and expected errors. Registry entries describe stable contracts and canonical bindings, without executing business logic. UI, HTTP, CLI and MCP requests reach this executor.

SQLite owns tasks, workspace revisions, grants, audit records, execution events, and idempotency receipts. Each short `task-mutation@1` workflow validates then persists. `BEGIN IMMEDIATE` rechecks grants and workspace identity, compares the revision, and atomically commits task state, revision, audit and receipt. Keys bind actor, workspace, operation and exact parsed input. Concurrent replay returns the original result; key reuse with different input and stale writes fail. No external effects occur.

The transaction runs synchronously without an asynchronous yield. Revocation cannot interleave inside one host process; SQLite serializes separate writers. Grant checks occur within the write transaction, so earlier committed revocation is respected. Cancellation before execution/commit rejects without writes. Once synchronous commit starts it completes atomically. This is a short transaction workflow, with no queued jobs, durable replay engine, extensions, executable artifact activation, or cross-app delivery. ARCH-009 through ARCH-011 are inapplicable. No sandbox or distributed workflow is invented.

TanStack Query is the only server-state UI cache. Keys include workspace, reads forward AbortSignal, mutation results update their own workspace cache, and 600 ms scoped polling observes host revisions and writes from CLI/MCP/other clients without refresh. Polling fetches fresh snapshots; a revision comparison retains the existing cache object when the revision has not changed and applies a replacement only for a new revision. There is no separate revision cache. The draft, theme, layout, and confirmation dialog are local state.

## Trust and data

This is a local OS-user application, not a multi-user remote service. Anyone who can access this loopback app or its data directory acts as the local user. The host creates an owner token with mode 0600. The web entry grants that local user an HttpOnly SameSite Strict cookie; every request rejects foreign Host and Origin headers before session bootstrap, authentication, discovery, or dispatch. Malformed URL paths return a client error without terminating the host. Client fields cannot assign an actor or grants. SQLite grants are authoritative. The example ships two workspaces and owner read/write grants, with a read-only Personal principal enabled only when the operator supplies `TASKS_READER_TOKEN`.

Local data defaults to `data/tasks.sqlite`. `TASKS_DATA` overrides the data folder, and `PORT` overrides the host port. Back up that folder while the host is stopped. Do not expose this example on a public address.

## Verify

All artifacts remain in this folder.

```sh
PLAYWRIGHT_BROWSERS_PATH=./.browsers npx playwright install chromium
npm run build
npm test
```

The corrected result declares 51 executable obligations. The original fresh-context first pass declared and passed 48 obligations, not 47. Its inventory missed foreign-Host session bootstrap and malformed URL failure checks. The parent audit in [`review/parent-review.json`](review/parent-review.json) found both defects with isolated real-host probes. Those findings prompted the authority/origin guard and safe URL parsing corrections, plus three new machine-readable obligations and negative tests. Every prior immutable report and the parent audit remain unchanged. The original trial and the corrected result are distinct runs; the expanded inventory makes them non-comparable in the reporter.

The independent inventory is `action-inventory.json`. `scripts/verify.ts` invokes actual HTTP, CLI subprocesses, SDK MCP clients and Chromium UI. It tests product outcomes, authentication, cross-scope access, permission-filtered discovery, input errors, revoked grants, stale and concurrent writes, forced SQL rollback, audit/receipt atomicity, idempotency replay/key conflicts, pre-commit cancellation, host restart, observed workflow events, live remote-interface UI writes, keyboard controls, deep-link refresh, light/dark/mobile rendering and icon centring. Tests use unique isolated data directories inside `verification/`, separate from user data.

`npm test` emits fresh assertion records with a source content digest, then runs the copied reporter with `--check`. `conformance/index.html` points to the latest immutable report. Earlier failed runs remain visible. Screenshot evidence is embedded in an HTML evidence file. `npm run report` rerenders supplied records only; it does not execute tests.

Test boundaries: revocation is verified before invocation and against the synchronous commit structure, not with a paused asynchronous race. Cancellation is verified before commit, not during indivisible SQLite execution. Restart proves persisted state and normal host cleanup, not kill-at-every-instruction crash recovery. No external providers are present. The optional architecture capabilities are not claimed.

## Agent documentation

Open `/docs/api` using the book icon in the header. The page has HTTP, CLI, MCP and all-surfaces views, searchable operation/tool names, stable anchors, copyable highlighted examples, and contract schemas. Search and surface selection survive refresh. Command K focuses search; Escape clears it.

`/docs/operations.json` exports the shared registry schemas and bindings; `/docs/openapi.json` exports the HTTP contract; `/llms.txt` links to these references and connection/authentication instructions. Public contracts expose no workspace records or credentials; runtime discovery remains permission filtered. Summaries and example inputs live beside operation definitions. MCP supports stdio tools only, with no resources or prompts.

The expanded profile adds eight documentation obligations, bringing the total to 59. Assertions fetch the deployed references, reconcile runtime HTTP/CLI/MCP bindings, exercise documented calls and retry/conflict behavior, check secret exposure and links, detect removed/stale schema entries, and verify browser search/filter/copy/deep links plus dark/light/mobile rendering. This documentation phase follows the original fresh-context trial and does not replace its retained evidence.

`/docs/api/table` provides a searchable table of every product operation and host endpoint, with surface filters and links to detailed contracts. Two additional UI obligations bring the profile to 61.
