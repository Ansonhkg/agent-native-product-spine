---
name: app-architecture-rules
description: Implements and reviews a portable agent-native application architecture with a trusted host, shared operations, thin UI/HTTP/CLI/MCP adapters, atomic mutations, observable workflows, catalog-backed API documentation, llms.txt, and executable product-action conformance. Use when creating, extending, migrating, or reviewing apps and their action coverage.
---

# App Architecture Rules

Build one product brain behind every interface. The trusted host owns authorization, execution, and durable state. Interfaces translate requests and render results. This package is self-contained: do not consult another project or repository to apply it.

## Required reading

- [rules.md](rules.md): mandatory rules, applicability, and verification.
- [contracts.md](contracts.md): operation, execution, persistence, and event contracts.
- [conformance.md](conformance.md): independent action inventory, executable checks, evidence, CI, and run directories.
- [examples.md](examples.md): generic architecture and operation examples.
- [documentation.md](documentation.md): mandatory API documentation page, machine references, and llms.txt.

Read all five before planning structural work. Apply the architecture to the app's actual capabilities. Do not create unused adapters, distributed workflows, or sandboxes solely to reproduce a diagram.

## Workflow

1. Inspect the app's entry points, interfaces, services, dependencies, authorization, storage, background jobs, and existing tests. Identify the trusted host boundary, including local desktop or browser-only boundaries where appropriate.
2. Inventory intended product actions independently of the operation registry. Include UI actions, backend capabilities, jobs, imports/exports, bulk actions, and external integrations. Classify local presentation and host-only actions explicitly. Trace event handlers and routes to find uncatalogued behavior.
3. Declare each action's scope, operation, required surfaces, workflow and live-update obligations. New apps start with zero debt. Existing apps may record exact inherited gaps; never add new debt silently.
4. Define contracts and a shared execution path. Implement Effect v4 services and thin adapters. Use TanStack Query for client server state, with shared query keys and deliberate revision-driven invalidation. Keep the package independent of any other skill; these stack requirements are included here.
5. Route mutations through an explicit validate-to-persist workflow. Enforce scope, permissions, revision checks, and atomic commits on the authoritative host. For workflows that must survive interruption, use Pi Durable with persistent storage, explicit checkpoints, and declared recovery behavior under ARCH-007. Include executable start/reopen/abort examples and recovery evidence. Apply optional isolation, activation, and delivery rules only when their capabilities exist.
6. Use slash-separated navigation URLs under ARCH-014, including page/resource scope, tabs, and documentation deep links. Do not use `#` or `?` to select application views. Provide a catalog-backed API documentation page and `/llms.txt`, following documentation.md. Cover every supported HTTP endpoint, CLI command, MCP tool/resource/prompt, and other agent interface. Update documentation and machine exports in the same change as their contracts.
7. Add structural and behavioral conformance checks in the same change as each action. Tests emit results for required action/surface/check triples. A catalog entry or named test alone never establishes a pass.
8. Save an immutable run directory and generate its HTML report. Inspect the affected running UI where relevant. Use evidence from real execution for integration claims; contract-only tests prove contracts only.
9. Run relevant project checks and the conformance gate. Report failures, blocked checks, unrun obligations, inherited debt, and test boundaries separately. Do not claim an action complete while its required checks remain unresolved.

## Reporting tool

Copy `scripts/report.py` and `assets/report.html` together into the adopting app, preserving their relative directory layout. The Python 3 standard-library reporter validates supplied records and renders reports; it does not run application tests or discover actions automatically. Resolve paths relative to this skill's actual directory when invoking it directly.

```sh
python3 scripts/report.py --input conformance-input.json --output conformance --check
```

For an explicitly illustrative example, run:

```sh
python3 scripts/report.py --demo --output examples/conformance
```

Demo data is labelled illustrative in every generated report and cannot pass a production gate. Never use it as evidence of application quality.

## Extension and exceptions

Keep unique, stable ARCH IDs. New user-requested rules are active unless marked proposed. Update related contracts and executable assertions together. Explicit user overrides take precedence; record the exact scope. Do not relax rules merely because a library or storage choice makes them inconvenient.
