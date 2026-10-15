# Fresh-context skill trial

## Setup

A subagent was started with no conversation history. It received the skill path, the product request below, the target directory, and permission to implement and verify the local example. It did not receive the preceding architecture discussion. Its ordinary system/developer instructions still apply; this is a test of skill application, not an otherwise instruction-free model.

## Product request

Create a task-manager app. Users can list, create, complete/reopen, and delete tasks within an explicitly selected workspace. Provide a web UI plus HTTP, CLI, and MCP access. Persist real data locally. Apply the bundled architecture skill and produce its required conformance report. Do not consult other projects or repositories, publish, or edit unrelated files.

## Evaluation criteria

- All requested product actions exist and appear independently in the inventory, including both complete and reopen behavior.
- Supported interfaces share the authoritative executor and service path.
- Contracts declare schemas, errors, mutation status, capabilities, scope, discovery, and interface bindings.
- Persistence enforces expected revisions, authorization, atomic state/audit changes, and applicable idempotency rules.
- Installed Effect is major version 4 and application execution actually uses it.
- TanStack Query owns remote UI state and the open UI observes writes from another interface.
- Conformance records come from actual executable assertions with evidence, not inferred or manually declared success.
- New-app baseline is empty and the report gate rejects unresolved requirements.
- Local UI actions and any host/helper routes are classified; exclusions are explicit.
- Conditional architecture requirements are applied where appropriate, without manufacturing unnecessary infrastructure.
- App is runnable, screenshots are inspected, and limitations are stated accurately.

## Results

The fresh-context first pass implemented the shared host executor, real HTTP/CLI/MCP adapters, Effect v4 execution, SQLite transaction boundaries, workspace scoping, TanStack Query cache ownership, live remote-interface updates, and an independent action inventory.

The first run retained a genuine UI-deletion selector failure. Later fresh-context runs passed all 48 declared obligations. The agent reported 47 in its completion message; independent inspection established the actual total as 48.

## Independent first-pass probes

Both probes ran against an isolated database and a separate host process, leaving the demo and user data untouched. Source hashes, original report identity, and redacted observations are preserved in [parent-review.json](tasks-app/review/parent-review.json).

| Probe | Expected | Observed | Outcome |
| --- | --- | --- | --- |
| Foreign Host on session bootstrap | Reject request without granting authority | HTTP 200 with owner session cookie | Failed |
| Malformed percent-encoded URL | Client error; host remains alive | Connection closed; host exited with code 1 | Failed |

The first issue exposes a missing host trust-boundary check (ARCH-002). The second exposes an unhandled transport-validation path (ARCH-003). Both were absent from the declared profile, so the green report did not detect them (ARCH-012).

**First-pass verdict:** the skill successfully conveyed the core architecture and evidence workflow, but did not ensure a complete host-boundary conformance profile. Passing declared assertions is narrower than full architecture compliance. The application is a functional example; it is not evidence that the skill guarantees correctness.

## Corrective phase

After recording the untouched first pass, the parent explicitly requested fixes and negative-test obligations for both findings. Subsequent code and reports therefore belong to a prompted corrective phase, not the original fresh-context result. Earlier reports and first-pass observations remain preserved.

The corrected build passed and the expanded executable profile passed **51/51 obligations**. The added checks cover foreign Host, foreign Origin, and malformed request URLs with host survival. The final report is [the corrective run](tasks-app/conformance/runs/20261002T171403Z-integration-55004118-25bd-4523-95c6-08e5fbedb867/report.html).

The parent independently repeated the probes against another isolated database and process: foreign Host and Origin returned 403 without a session cookie; the malformed URL returned 400; a subsequent normal request returned 200 and the host remained alive. Redacted observations are preserved in [parent-review-corrected.json](tasks-app/review/parent-review-corrected.json).

The parent also created and completed sample tasks in the retained demo at http://127.0.0.1:4347/?workspace=personal and inspected the [running UI screenshot](tasks-app/review/parent-demo.png). Visible controls are centered and content fits its containers. The skill itself has not been modified during this trial.

## Skill improvement indicated by the trial

A future revision should supply a mandatory minimum cross-cutting profile, including session bootstrap, Host/Origin checks, malformed transport inputs, authorization/discovery, output contracts, transaction conflicts, and evidence provenance. App-specific actions would extend that profile. Keep inventory review explicit: a runner can verify declared obligations without discovering every omitted boundary.
