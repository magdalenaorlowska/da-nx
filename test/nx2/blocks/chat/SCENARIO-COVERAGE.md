# Scenario coverage matrix

Maps every scenario in `ew-server-side/.env/scenarios.md` (89 scenarios, 20 sections) to
its Tier-1 spec file. Spec files are numbered to match section numbers
(`<n>-<kebab-title>.test.js`).

**Status:** `covered` · `partial` · `not-automatable` · `deferred-to-playwright` (Tier-2) · `not-started`.
**Backend:** `da-agent` · `AO` · `both`.

**Assertion library:** chai (unchanged). Considered swapping to standalone `expect`
(Jest/Playwright matchers, e.g. `.to.deep.equal(y)` → `.toEqual(y)`) — no CI cost, but
unverified browser compatibility. Full Playwright was also considered but needs new
browser binaries + a CI step; both deferred.

| # | Scenario | Spec file | Status | Backend | Notes |
|---|---|---|---|---|---|
| 1.1 | Create a page | `1-content-crud.test.js` | covered | da-agent | |
| 1.2 | Read a page | `1-content-crud.test.js` | covered | da-agent | |
| 1.3 | Update a page | `1-content-crud.test.js` | covered | da-agent | |
| 1.4 | Delete a page | `1-content-crud.test.js` | covered | da-agent | |
| 1.5 | List a folder | `1-content-crud.test.js` | covered | da-agent | |
| 1.6 | Copy a page | `1-content-crud.test.js` | covered | da-agent | No-approval gap documented inline (see Open Items #3). |
| 1.7 | Move / rename a page | `1-content-crud.test.js` | covered | da-agent | Also asserts `affectedFolders()`. |
| 1.8 | Version history | `1-content-crud.test.js` | covered | da-agent | |
| 1.9 | Media / fragment lookup | `1-content-crud.test.js` | covered | da-agent | |
| 2.1 | Upload + place in a page | `2-uploads-images.test.js` | covered | da-agent | attachmentRef preference/dot-folder convention are server-side, not tested. |
| 2.2 | Upload a standalone asset | `2-uploads-images.test.js` | covered | da-agent | |
| 2.3 | Attachment resolution failure | `2-uploads-images.test.js` | covered | da-agent | Client just surfaces server `errorText`. |
| 2.4 | contentUrl swap after upload | `2-uploads-images.test.js` | covered | da-agent | |
| 3.1 | Preview a page | `3-single-page-preview-publish.test.js` | covered | da-agent | |
| 3.2 | Publish a page | `3-single-page-preview-publish.test.js` | covered | da-agent | "Preview-then-promote" is server-side; tests client's success/error halves. |
| 3.3 | Unpreview / unpublish | `3-single-page-preview-publish.test.js` | covered | da-agent | |
| 4.1 | Bulk preview | `4-bulk-canvas-operations.test.js` | not-automatable | da-agent | Gap — see Open Items #6. |
| 4.2 | Bulk publish | `4-bulk-canvas-operations.test.js` | not-automatable | da-agent | Same as 4.1. |
| 4.3 | Bulk delete | `4-bulk-canvas-operations.test.js` | not-automatable | da-agent | Same as 4.1. |
| 4.4 | Cancel a bulk dialog | `4-bulk-canvas-operations.test.js` | not-automatable | da-agent | Same as 4.1. |
| 5.1 | Plan and run a multi-step request | `5-multi-step-planning.test.js` | covered | da-agent | `enter_plan_mode` new; `exit_plan_mode` pre-covered elsewhere. |
| 5.2 | Plan card Run gating | `5-multi-step-planning.test.js` | covered | da-agent | New: Run disabled while running/done. |
| 5.3 | Collapsed running-task view | `5-multi-step-planning.test.js` | covered | da-agent | |
| 5.4 | Standalone task list | `5-multi-step-planning.test.js` | covered | da-agent | |
| 6.1 | Approve a destructive action | `6-approval-flows.test.js` | covered | da-agent | Pre-covered by `chat-controller.test.js`. |
| 6.2 | Reject an action | `6-approval-flows.test.js` | covered | da-agent | Pre-covered, same suite. |
| 6.3 | Always-approve for the session | `6-approval-flows.test.js` | covered | da-agent | Pre-covered, same suite. |
| 6.4 | Keyboard-driven approval | `6-approval-flows.test.js` | covered | da-agent | New (lives in `interaction.js`). |
| 6.5 | Skill save doesn't block on approval | `6-approval-flows.test.js` | covered | da-agent | |
| 6.6 | Approving a new agent preset | `6-approval-flows.test.js` | covered | da-agent | |
| 7.1 | Evaluate a page | `7-governance-evaluation.test.js` | covered | da-agent | New: loading/error states. |
| 7.2 | Category/image drill-down | `7-governance-evaluation.test.js` | covered | da-agent | Pre-covered by `governance-evaluation-card.test.js`. |
| 7.3 | Live Preview URL used | `7-governance-evaluation.test.js` | not-automatable | da-agent | Server-only instruction, no client behavior. |
| 7.4 | Continuation gate — Continue/Stop | `7-governance-evaluation.test.js` | covered | da-agent | Gate disabled server-side — see Open Items #1. |
| 8.1 | Generate a schema | `8-structured-content.test.js` | covered | da-agent | Grouped with 8.2/8.4. |
| 8.2 | Import against a schema | `8-structured-content.test.js` | covered | da-agent | Grouped test. |
| 8.3 | Validate without saving | `8-structured-content.test.js` | covered | da-agent | |
| 8.4 | End-to-end authoring | `8-structured-content.test.js` | covered | da-agent | Grouped test. |
| 8.5 | Correct editor URL | `8-structured-content.test.js` | covered | da-agent | |
| 8.6 | Structured Content Expert preset | `8-structured-content.test.js` | not-automatable | da-agent | No client preset UI — see Open Items #8. |
| 8.7 | Pause on reserved schema keys | `8-structured-content.test.js` | not-automatable | da-agent | Degrades to plain text on da-agent (no `question` type). |
| 9.1 | Slash-menu skill | `9-skills.test.js` | covered | da-agent | Pre-covered by `chat.test.js`. |
| 9.2 | Read skill instructions | `9-skills.test.js` | covered | da-agent | |
| 9.3 | Save a drafted skill | `9-skills.test.js` | covered | da-agent | Same as 6.5's test. |
| 9.4 | `[SKILL_SUGGESTION]` card | `9-skills.test.js` | not-automatable | da-agent | Gap — see Open Items #7. |
| 9.5 | Skill not found | `9-skills.test.js` | not-automatable | da-agent | Server-only text response. |
| 9.6 | Skills Engineer preset | `9-skills.test.js` | not-automatable | da-agent | No client preset UI — see Open Items #8. |
| 10.1 | List available presets | `10-agent-presets.test.js` | covered | da-agent | |
| 10.2 | Create a preset with skills/MCP | `10-agent-presets.test.js` | covered | da-agent | Asserts bundled input travels with the tool call. |
| 11.1–11.4 | Project Memory | `11-project-memory.test.js` | not-started | da-agent | |
| 12.1–12.4 | Rich Response Formatting | `12-rich-response-formatting.test.js` | not-started | da-agent | |
| 13.1–13.2 | Custom MCP Servers | `13-custom-mcp-servers.test.js` | not-started | da-agent | |
| 14.1–14.6 | Selection Context & Attachments | `14-selection-context-attachments.test.js` | not-started | da-agent/client-shared | |
| 15.1–15.2 | Clarifying Questions | `15-clarifying-questions.test.js` | not-started | **AO-only** | No da-agent equivalent. |
| 16.1–16.2 | Plan Approval With Feedback | `16-plan-approval-with-feedback.test.js` | not-started | **AO-only** | |
| 17.1–17.3 | Episode Continuity | `17-episode-continuity.test.js` | not-started | **AO-only** | |
| 18.1–18.4 | UI Artifacts | `18-ui-artifacts.test.js` | not-started | **AO-only** | |
| 19.1–19.6 | Welcome/Prompts/Persistence | `19-welcome-prompts-persistence.test.js` | not-started | both | |
| 20.1–20.7 | Error & Edge Cases | `20-error-edge-cases.test.js` | not-started | both | 20.5: AO/da-agent differ in failure shape. |

## Open items

### General (cross-cutting, not tied to one test case)

1. **da-agent vs. AO split** (§§15–18 AO-only) — open question for cloudbridge: which contract does it adopt?
2. **Approval-gating inconsistency** — `content_copy`, `content_version_create`, and the 4 EDS tools mutate but aren't approval-gated, unlike `content_create`/`update`/`delete`/`move`/`exit_plan_mode`/`da_create_agent`. Verified directly against `da-agent/src/tools/tools.ts`. May be intentional; flagged, not fixed.
3. **UNCONFIRMED:** tool-name collision behavior between a custom MCP server and a built-in one.

### Test-case specific

- **[7.4]** Continuation gate disabled server-side — `continuationApprovalPatterns` is commented out in da-agent. Client is ready; nothing live triggers it.
- **[7.4]** UNCONFIRMED: whether any live MCP server actually triggers the continuation gate.
- **[7.1, 8.1–8.4]** UNCONFIRMED: MCP-tool approval gating. `da-agent/src/mcp/tool-adapter.ts` fail-closes MCP-discovered tools (`evaluate_page`, `sc_*`) to needing approval unless the MCP server annotates `readOnlyHint`/`destructiveHint`. governance-agent/da-sc-mcp source isn't available locally, so whether these actually skip approval in production (as these tests assume) is unverified — unlike the tools.ts-based tools above, which are confirmed directly.
- **[4.1–4.4]** Bulk Canvas Operations — dialog exists, wiring doesn't. da-agent's `CANVAS_CLIENT_ONLY_TOOLS` (`da_bulk_preview`/`publish`/`delete`) expects the AI SDK's client-tool-execution mechanism to run them and show a confirmation dialog. That dialog exists (`da-live/blocks/browse/da-list/da-list.js`'s `_confirm`/`renderConfirmDialog`) but belongs to the browse UI's manual multi-select toolbar — nothing connects it to a tool call, in da-nx or da-live. A wiring gap, not a missing feature.
- **[9.4]** `[SKILL_SUGGESTION]` card — no client renderer at all (confirmed by a workspace-wide grep, including da-live/ew-extensions). da-agent's prompt-builder.ts describes it; nothing implements it. `ew-extensions`'s Skills Editor has a same-named-sounding "suggestion handoff" (sessionStorage + window events) — checked and it's unrelated/dead: nothing anywhere dispatches it.
- **[8.6, 9.6]** Persona/preset switching has no dedicated client UI, and this looks intentional — no da-nx file cited for either, no "switch preset" tool in da-agent, and `chat.js`'s menu has no such item. (`ew-extensions`'s Skills Editor does have full agent-preset CRUD (`loadAgentPresets`/`saveAgentPresetFile`) — but that manages preset *definitions* as admin data, not switching the active persona for a chat session, so it doesn't change this verdict.)