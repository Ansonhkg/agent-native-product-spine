# Agent-native documentation

The shipped app provides a human-readable API documentation page and `/llms.txt`. These are required deliverables for new apps and explicit migration obligations for existing apps. A README alone is insufficient. This document contains the complete requirement; no other repository is needed.

## API documentation page

Use `/docs/api` by default, or an existing stable documentation route. Link it from app navigation or Help. Support direct navigation and reload, searchable operation/tool names, surface filters (HTTP, CLI, MCP, and all supported surfaces), and stable slash-separated per-operation deep links under ARCH-014, such as `/docs/api/operations/items.create`. Documentation sections also use paths, such as `/docs/api/mcp`; do not select documentation views with `#` or `?`. Show unsupported bindings explicitly in the comparison view. Apply the app's accessibility and UI conventions; syntax-highlight code and offer copyable examples without live credentials. An execution playground is optional and must never execute mutations merely by visiting or copying a reference.

Include:

- Quick start: service/base URL configuration, authentication setup, explicit workspace/resource scope, connection lifecycle, and a safe read example.
- HTTP: every supported endpoint's method/path, path/query/header/body schemas, successful responses, expected errors and status codes, pagination, and any streaming/event protocol.
- CLI: installation/start commands, commands and arguments, credential configuration, output formats, exit/error behavior, and examples when supported.
- MCP: actual transport and connection configuration, authentication/scope setup, all exposed tools with exact names and input/result/error contracts, and all supported resources/resource templates and prompts. State explicitly when resources or prompts are not supported. Include call examples and read/write or other applicable tool annotations. Do not advertise a transport or feature the app does not implement.
- Other supported agent interfaces and extension-provided capabilities: connection instructions, discovery, contracts, and how they resolve to shared operations. Distinguish host/helper interfaces from product operations.
- Each operation: stable ID, purpose/domain, read or mutation classification, required capabilities/scope, input/output/error schemas, eligible surface bindings, and valid examples. Explain revision conflicts, idempotency/retry policy, cancellation, asynchronous run observation, and live updates wherever applicable.

Generate operation tables, bindings, schemas, and machine references from canonical contracts. Handwritten quick starts and semantic explanations are allowed, but cannot maintain a competing tool or operation list. Reconcile plugin/extension ownership with the same registry. Unknown IDs, missing entries, stale bindings, and undocumented helper endpoints are failures, not silently filtered omissions.

Export machine-readable HTTP contracts at a linked stable route (OpenAPI where it accurately represents the implemented HTTP interface). Provide a linked JSON operation/tool catalog with schema and binding metadata for all supported surfaces. Reuse adapter schemas rather than rewriting them for documentation. Exports describe contracts; they do not establish authority or execute business logic.

## llms.txt

Serve `/llms.txt` as UTF-8 plain text containing concise Markdown. It is an agent entry point, not the complete API contract. Generate its interface/catalog links from the documentation configuration and canonical metadata. Include:

1. App name and a short description.
2. Documentation and quick-start links.
3. HTTP machine contract and operation/tool catalog links.
4. MCP connection/tool reference and CLI reference links when supported, plus any other agent interface.
5. Authentication and scope instructions, mutation/retry cautions, and links to execution/run observation where applicable.

Links must resolve from the deployed app origin. For local-only apps, use relative links and configurable local startup commands. Do not require agents to locate a development checkout or another project to understand the interface. `/llms-full.txt` is optional; if provided, generate it from the same documentation source and check freshness.

Public documentation may explain the public contract without granting invocation rights. Runtime discovery and any caller-specific documentation remain permission-filtered. Do not expose credentials, private workspace data, restricted extension metadata, internal paths, or privileged configuration in public pages, examples, catalogs, or llms.txt. Document placeholder credentials and how the caller obtains their own authority.

## Minimal example

```text
# Example App

> Manage items in an explicitly selected workspace through shared operations.

## References
- [API documentation](/docs/api): HTTP, CLI, MCP and operation contracts.
- [HTTP contract](/docs/openapi.json): Machine-readable HTTP reference.
- [Operation catalog](/docs/operations.json): Schemas and surface bindings.
- [MCP connection](/docs/api/mcp): Transport, authentication and tool calls.
- [CLI reference](/docs/api/cli): Commands and output conventions.

## Access and writes
Authenticate using your own credentials and select a workspace explicitly.
See [mutation semantics](/docs/api/mutations) for revisions and retry rules.
```

These paths are illustrative defaults. Ship only references that actually exist, and omit unsupported interface links.

## Executable conformance

Inventory documentation as host/read-only actions and search/filter/copy as local UI actions where present. Required checks:

- Fetch the documentation route directly and after reload; fetch llms.txt and machine exports with expected content types and valid content.
- Compare documented operation IDs, HTTP bindings, CLI commands, MCP tools/resources/prompts, and helper routes with the actual supported runtime interfaces. Do not compare two generated copies while ignoring runtime registration.
- Validate exported schemas and example requests/responses against canonical contracts. Exercise representative documented HTTP, CLI, and MCP calls through actual adapters in isolated test scopes; demonstrate authentication, scope, and an expected error. Where supported, verify a documented mutation and its conflict/retry behavior.
- Resolve internal links and operation reference paths, including every llms.txt reference. Test search/filter/deep links and successful copy feedback; inspect the running documentation UI.
- Assert permission-filtered discovery and absence of secrets/private metadata from public documentation exports, including anonymous and restricted callers where supported.
- Change or add a contract in a controlled test/build fixture and prove stale or missing documentation is detected. Produce real assertion evidence in the ordinary immutable conformance runs.

New apps cannot pass with these obligations missing, unrun, or baselined. Existing apps record exact inherited documentation gaps under the normal ratchet, and every new or changed interface ships current documentation and proofs in the same change.

## Durable workflow documentation

For operations that must survive interruption, ship runnable, typechecked examples covering admission, returned run identity, reopening storage, observing progress and explicit abort. Include expected output and a forced-restart procedure. State which phases can repeat, how external effects are deduplicated or reconciled, and which failures require operator action. Explain that disconnecting an observer differs from aborting a run. Declare the selected Pi Durable version, persistent storage requirements, single-writer policy and unfinished-definition compatibility policy. Recovery examples must not depend on paid model calls solely to demonstrate scheduling.

Keep examples under ordinary checks against installed dependency types. A process-kill example proves only its asserted recovery boundary; mocks and pure computation do not prove external provider idempotency or application integration. Record failed, blocked and unrun checks under the existing conformance policy.
