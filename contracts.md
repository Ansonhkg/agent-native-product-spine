# Portable contracts

These are conceptual contracts. Implement them with the app's type/schema system and installed Effect v4 APIs, not by copying fictional library calls.

## Operation definition

Each operation declares:

- `id`: permanent domain-qualified identity, for example `items.create`.
- Input, successful output, and expected-error schemas.
- `mutates`, required capabilities, and explicit resource scope.
- Eligible surfaces and canonical HTTP/CLI/MCP bindings when supported.
- Handler/service identity and workflow identity for mutations.
- Retry/idempotency policy and observable live-state domain.
- Documentation metadata: summary/domain, canonical schema references, valid example inputs/results, and stable slash-separated reference path. Adapter bindings supply transport-specific details. Generate API references and machine catalogs from these contracts as specified in documentation.md.

The registry describes operations. An executor resolves the handler and applies shared policy. Interface discovery filters this registry for the caller.

## Invocation

An invocation carries operation ID, untrusted input, authenticated principal, requested scope, correlation ID, optional idempotency key, and cancellation signal. Principal and effective grants come from trusted authentication, not request fields.

Execution order:

1. Resolve operation and surface eligibility.
2. Authenticate; intersect capabilities, grants, and requested resource scope.
3. Validate input and capture required state/version revisions.
4. Execute typed application services or a controlled extension.
5. Validate output and proposed changes. Read-only operations cannot propose writes.
6. Recheck mutable authorization and expected revisions at commit.
7. Commit durable changes and associated audit/receipt/outbox records atomically.
8. Return the validated result and emit the observable revision change.

Reads may call a shared service without a multi-step workflow when no multi-step policy is needed. Every durable mutation has an explicit validate/persist path.

## Persistence port

Provide scoped reads and transactions with expected revisions. A transaction either commits every associated write or none. Uniqueness, revocation, deletion identities, and activation consistency must hold at the authoritative boundary, not only in an earlier host check.

A successful idempotency receipt binds key, operation, input, actor/scope, and result. Reusing a key for different input fails. Concurrent requests and lost acknowledgements require verified handling. Database transactions do not roll back external provider actions.

## Workflow and event contract

A run pins an immutable definition ID/version and records phase, attempts, transitions, start/finish timestamps, and committed artifacts. Each event includes stable event ID, run ID, operation/step identity, attempt, timestamp, event kind, and safe details.

Distinguish requested, started, committed, completed, failed, blocked/waiting, and interrupted events. Cancellation stops pending work and waits for cleanup; committed effects remain committed. On restart, explicitly choose interruption, safe resumption, or idempotent replay and verify it.

## Client contract

UI invokes through transport-shaped adapters. TanStack Query owns server-state cache and mutation status. Host revisions drive targeted invalidation or result updates, including mutations made through other interfaces. Local form drafts and presentation state remain local. Connect query AbortSignal to the Effect boundary; mutation cancellation requires its own documented mechanism.


## Navigation contract (ARCH-014)

Define canonical slash-separated paths for every addressable page, resource/scope, tab, and documentation reference. For example, use `/workspaces/personal/items/123/details` instead of `/#/items/123` or `/items?id=123&tab=details`, and `/docs/api/operations/items.create` instead of `/docs/api#items.create`. Encode dynamic values as individual path segments and validate decoded values. Navigation URL builders and parsers must round-trip to the same view without search parameters or fragments. Use client-side routing and configure the host to serve the app on direct loads of valid routes. Reload and browser Back/Forward restore the addressed view. API input queries and externally required protocol parameters remain governed by their transport contracts.

## Durable execution under ARCH-007

Use Pi Durable when accepted work must survive process crashes, restarts, or application closure. Ordinary short operations and in-process retries do not require a durable workflow. Verify APIs against the selected installed package version; the API is experimental. Pin exact external dependency versions and retain each unfinished run's compatible definition by immutable task identity or an equivalent version-aware deployment policy.

Effect v4 owns application services, typed errors, retry and cleanup within an invocation. Pi Durable owns persistent task state, checkpoints and scheduling after restart. Bridge its Promise APIs at the Effect boundary using installed Effect APIs. TanStack Query remains the client server-state owner; updates feed its cache or targeted invalidation, not a competing application cache. This choice does not require a model provider, TUI, remote services or Chord plugin composition.

The host opens persistent storage and admits a task with its stable identity and scoped request receipt. On restart, reopen the same storage and recover the existing task instead of creating a replacement. MemoryStorage is not restart persistence. The host must enforce one storage owner: the storage package does not provide cross-process writer locking.

Each task phase commits its next checkpoint or terminal outcome. Pure computation may repeat after interruption. External effects execute outside commit callbacks and require a stable persisted effect key plus provider idempotency, reconciliation, or explicit interruption. A durable memo written before an external call does not prove that call completed; a memo written afterward does not prevent duplicate execution after a crash. Pi's tool flag `replay: "safe"` applies to tools; arbitrary custom task phases require their own safety protocol. Never claim exactly-once external effects from checkpointing alone.

Durable task state and unrelated business databases are not automatically one transaction. Implement and verify a shared transaction or an explicit receipt/outbox/reconciliation protocol wherever ARCH-004 requires atomicity. Reauthorize effect execution and final mutations against current host authority; stored actor/scope values do not grant authority.

Publish authoritative progress only after successful commits. An uncertain storage outcome must stop further mutations until reconciliation or reopening. Cancelling an observer or wait stops observation; it does not abort admitted durable work. Aborting work is an explicit authorized operation and waits for cleanup. Process shutdown leaves unfinished durable work recoverable; product cancellation records its own outcome.
