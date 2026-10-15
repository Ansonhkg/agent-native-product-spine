# Product-action conformance

## Inventory and profiles

Inventory intended behavior independently of registered operations. Reconcile UI event handlers, routes, tools, commands, scheduled jobs, imports/exports, bulk actions, and product requirements. No static scanner can prove this inventory is complete; retain review evidence and flag unmatched handlers/routes.

Classify each stable action ID as `product`, `local`, `host`, or `external`. Product actions name an operation and scope. Local presentation actions need UI checks but no invented backend operation. External actions declare the integration boundary and required evidence; unavailability is blocked, not passed. Host actions declare their supported operator interfaces.

A profile identifies supported surfaces and release obligations. Declare expectations per action as `(surface, check)` pairs, allowing checks for different surfaces to differ. Do not require UI, CLI, MCP, or HTTP where the product explicitly does not support them. Every supported product interface must use the shared operation path.

## Required check families

- Structural: contracts, unique IDs/bindings, route round-trip, handler wiring, shared service ownership, workflow ownership, scope metadata, discovery filtering, live owner/revision wiring, and inventory reconciliation.
- Behavioral: actual result and state, input/output errors, denied capability, cross-scope rejection, stale revisions, atomic commit, retry/idempotency, cancellation and cleanup where applicable.
- Cross-surface: invoke through each required adapter and prove the same semantics. For a product list/editor, mutate through another interface while it is open and verify the expected live change without manual refresh.
- Optional capabilities: isolated extension boundaries, candidate activation, workflow restart, and durable delivery assertions whenever present.
- Navigation (ARCH-014): inventory addressable pages, resource/scope views, tabs, and documentation references independently of route registration. Assert generated and rendered navigation links have slash-separated paths with empty search/hash; exercise encoded path-value round-trips, client-side transitions, direct loads, reloads, and browser Back/Forward. Verify the expected view and scope after each transition. API input queries and external protocol parameters are outside this check.
- Agent documentation (ARCH-013): documentation/llms.txt availability and links, machine contract validity, runtime-to-documentation parity for every supported interface, valid executable examples, safe exposure, and stale-document detection. Follow documentation.md; classify these as required host/local obligations rather than inferring a pass from a generated page.

Use parameterized assertions where contracts allow them, plus domain-specific outcome tests. Contract transport tests prove request/response behavior only. Integration claims require the actual executor, services, storage, and relevant interfaces. Isolate test scopes from user data. Never promote synthetic examples, mocks, registry entries, or test names into integration proof.

## Results and evidence

The adopting app's runner writes one result per required triple. Status is `passed`, `failed`, `blocked`, or `unrun`. A skip is unrun; environmental unavailability is blocked. Missing results become unrun. A passing result requires test ID and a relative evidence-file path. Save safe assertion output, logs, traces, screenshots, and actual observed outcomes as appropriate.

Tie every run to code revision (including dirty-tree identity where applicable), environment, profile, and the inventory/obligation digest. The reporter creates a unique immutable directory, copies evidence, writes run/result/input JSON, and renders HTML. It never executes tests or vouches for supplied records. CI must obtain records from its trusted runner; do not manually write passed results. Redact secrets and personal data before passing artifacts to the reporter.

```text
conformance/
├── index.html                 latest report, evidence links target its run
└── runs/
    └── <timestamp>-<run-id>/
        ├── run.json
        ├── input.json         inventory, profile, exact baseline
        ├── results.json       normalized required results
        ├── report.html
        ├── logs/              safe runner output, referenced as evidence
        └── evidence/          screenshots, traces, other assertion artifacts
```

Input is JSON to avoid dependencies. Example shape:

```json
{
  "run": {"id": "ci-123", "at": "2026-10-02T12:00:00Z", "revision": "commit-or-content-digest", "environment": "isolated-integration", "profile": "release", "mode": "new"},
  "actions": [{"id": "items.create", "domain": "Items", "label": "Create item", "kind": "product", "operation": "items.create", "scope": "workspace", "expectations": [{"surface": "cli", "check": "execution"}]}],
  "results": [{"action": "items.create", "surface": "cli", "check": "execution", "status": "passed", "testId": "items.create.cli", "evidence": "logs/items-create.txt", "message": "Observed record and audit commit."}],
  "baseline": []
}
```

Evidence paths resolve relative to the input file. They must remain inside its directory. The app runner collects its artifacts there before reporting.

## Gate policy

**New app:** empty baseline; every required obligation must pass. Missing, blocked, unrun, or failed requirements fail the gate.

**Existing app:** exact inherited `(action, surface, check)` entries may remain with reason and review owner. Every unresolved obligation outside that reviewed baseline fails. Resolved/stale baseline entries fail until removed. A baseline permits migration progress, not a claim that its action or release profile conforms. Protect baseline changes through code review; the reporter cannot distinguish inherited debt from newly disguised debt.

`--check` exits nonzero when the applicable policy fails, after saving the report. A release conformance claim always requires all requirements to pass, even if a migration gate accepts baseline debt. Illustrative reports always fail a production gate.

## Report interpretation

Show distinct action-level full conformance, surface adapter wiring, and individual assertion outcomes. Empty denominators are N/A. Domain stacked bars show assertion statuses, not operation wiring masquerading as coverage. Matrix cells aggregate their required assertions; expanding an action exposes all results and evidence. Baseline failures remain visible failures.

Compare runs only when profile, environment, illustrative flag, and obligations match. Show resolved gaps, regressions, and other status changes. An inventory change is reported as not comparable; inventory changes also need explicit review so removing an action cannot hide a gap.

## Adopting the suite

1. Create the independent inventory, profile, and empty or reviewed inherited baseline.
2. Implement structural reconciliation checks and real behavioral tests using the app's runner.
3. Emit input/results and evidence under an isolated staging directory.
4. Run the bundled reporter with `--check` in CI; retain each immutable run as an artifact.
5. For release acceptance, require zero unresolved obligations. Add every new action and its proofs in the same change.

## Durable recovery checks (ARCH-007)

For each workflow required to survive interruption, emit executable evidence for:

- Durable admission and task identity: lose the initial acknowledgement, restart, and recover the same scoped run without duplicate admission; conflicting request-key reuse fails.
- Process-crash recovery: kill the worker after a confirmed checkpoint, reopen persistent storage, and verify committed work is preserved and remaining phases continue.
- Effect/checkpoint gap: kill after an external effect but before its completion checkpoint; verify provider idempotency, reconciliation, or explicit interruption prevents blind duplicate effects. Safe tool replay and unsafe tool interruption need separate assertions when tools exist.
- Observation and cancellation: disconnect a client or cancel a wait while work continues; reconnect to committed progress. Explicit abort waits for cleanup and does not undo committed effects.
- Definition compatibility and authority: changing deployed code must not silently change an unfinished run's definition; revoked grants prevent protected resumed effects and final writes.
- Storage and publication: enforce one writer; storage failures cannot publish successful progress. Prove any required business-state/audit/receipt/outbox atomicity across actual stores.

The included counter example proves neither authorization nor external-effect safety. Its standalone verifier covers only forced process termination after a committed checkpoint, recovery of the same task, and no phase execution after terminal completion. Map actual assertions into the existing action/surface/check report; do not mark untested obligations passed.
