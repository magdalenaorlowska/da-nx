import { expect } from '@esm-bundle/chai';
import { render } from 'da-lit';
import ChatBackend from '../../../../nx2/blocks/chat/chat-backend.js';
import { renderMessage } from '../../../../nx2/blocks/chat/renderers/renderers.js';
import { AGENT_EVENT, TOOL_NAME } from '../../../../nx2/blocks/chat/constants.js';

// Tier-1 contract/flow tests for scenarios.md §8 "Structured Content (da-sc-mcp)"
// (scenarios 8.1–8.7), da-agent path, gated server-side on DA_SC_MCP_URL.
//
// Confirmed by repo-wide grep: da-nx has NO client-side special-casing for any
// mcp__da-sc__* tool (sc_compile_schema/sc_validate_document/sc_serialize_*) — they're
// generic tool calls, already proven by Section 1/2/3's "generic no-approval tool"
// tests. Rather than pad this file with 7 near-duplicate generic-tool-card tests, this
// covers what's actually distinct per scenario:
// - 8.1/8.2/8.4 all end by saving through content_create — the one already-approval-
//   gated tool (Section 1) — so the real thing worth proving here is that an SC
//   workflow's *save* step still goes through the same approval gate, even though the
//   validate/compile/serialize steps around it don't.
// - 8.3 is the pure no-save case: an entire turn of generic MCP calls with no
//   content_create at the end, so nothing should ever suspend the turn.
// - 8.5 pins the specific URL convention the scenario cares about (form editor, never
//   /edit) — generic link rendering itself is already covered by renderers.test.js.
// - 8.6 (persona preset) and 8.7 (pause on reserved keys) are addressed in comments
//   below, not with padding tests — see SCENARIO-COVERAGE.md.

function makeBackend() {
  const updates = [];
  const backend = new ChatBackend(false, { onUpdate: (u) => updates.push(u) });
  backend._controller._messages = [];
  return { backend, updates };
}

describe('8.1/8.2/8.4 Schema generation, import, and end-to-end authoring — save step is still approval-gated', () => {
  it('compile/validate/serialize resolve without approval, but the final content_create still suspends the turn', () => {
    const { backend, updates } = makeBackend();
    const c = backend._controller;

    c._onToolEvent({ type: AGENT_EVENT.TOOL_INPUT_AVAILABLE, toolCallId: 't1', toolName: 'mcp__da-sc__sc_compile_schema', input: {} });
    c._onToolEvent({ type: AGENT_EVENT.TOOL_OUTPUT_AVAILABLE, toolCallId: 't1', output: { valid: true } });
    expect(updates.at(-1).pendingInteraction).to.equal(null);

    c._onToolEvent({ type: AGENT_EVENT.TOOL_INPUT_AVAILABLE, toolCallId: 't2', toolName: 'mcp__da-sc__sc_serialize_schema', input: {} });
    c._onToolEvent({ type: AGENT_EVENT.TOOL_OUTPUT_AVAILABLE, toolCallId: 't2', output: { serialized: '<div>...</div>' } });
    expect(updates.at(-1).pendingInteraction).to.equal(null);

    c._onToolEvent({
      type: AGENT_EVENT.TOOL_INPUT_AVAILABLE,
      toolCallId: 't3',
      toolName: TOOL_NAME.CONTENT_CREATE,
      input: {
        path: '/.da/forms/schemas/testimonial.html',
        humanReadableSummary: 'Save the testimonial schema',
      },
    });
    c._onToolEvent({ type: AGENT_EVENT.TOOL_APPROVAL_REQUEST, toolCallId: 't3' });

    expect(updates.at(-1).pendingInteraction).to.deep.equal({
      type: 'approval', toolCallId: 't3', toolName: TOOL_NAME.CONTENT_CREATE, summary: 'Save the testimonial schema',
    });
  });
});

describe('8.3 Validate without saving', () => {
  it('never suspends the turn when the flow has no save step', () => {
    const { backend, updates } = makeBackend();
    const c = backend._controller;
    c._onToolEvent({ type: AGENT_EVENT.TOOL_INPUT_AVAILABLE, toolCallId: 't1', toolName: 'mcp__da-sc__sc_compile_schema', input: {} });
    c._onToolEvent({ type: AGENT_EVENT.TOOL_OUTPUT_AVAILABLE, toolCallId: 't1', output: { valid: true } });
    c._onToolEvent({ type: AGENT_EVENT.TOOL_INPUT_AVAILABLE, toolCallId: 't2', toolName: 'mcp__da-sc__sc_validate_document', input: {} });
    c._onToolEvent({ type: AGENT_EVENT.TOOL_OUTPUT_AVAILABLE, toolCallId: 't2', output: { valid: false, errors: ['missing quote'] } });

    const last = updates.at(-1);
    expect(last.pendingInteraction).to.equal(null);
    expect(last.toolCards.get('t2').output.valid).to.equal(false);
  });
});

describe('8.5 Correct editor URL for structured content (never /edit)', () => {
  it('renders the form-editor URL as a link, not a bare /edit path', () => {
    const host = document.createElement('div');
    const url = 'https://da.live/form#/acme/site/testimonials/jane-doe';
    render(renderMessage({ role: 'assistant', content: `You can edit it here: ${url}` }), host);
    const link = host.querySelector('.message-content a');
    expect(link.getAttribute('href')).to.equal(url);
    expect(link.getAttribute('href')).to.not.contain('/edit');
  });

  it('renders the schema-editor URL (org/site scoped, no document path) as a link', () => {
    const host = document.createElement('div');
    const url = 'https://da.live/apps/schema#/acme/site';
    render(renderMessage({ role: 'assistant', content: `The schema editor is at ${url}` }), host);
    expect(host.querySelector('.message-content a').getAttribute('href')).to.equal(url);
  });
});

// 8.6 "Structured Content Expert preset" — confirmed by repo-wide grep: da-nx has no
// client-side agent-preset/persona switching UI at all (no da-agent's builtin-presets.ts
// equivalent on the client side). Switching persona is a pure server-side system-prompt
// swap with zero client-observable difference — there is nothing at this boundary to
// assert. Marked not-automatable in SCENARIO-COVERAGE.md rather than tested trivially.

// 8.7 "Reserved/disallowed schema key requires a pause" — da-agent's "pause and ask
// per-key" has no dedicated client UI on the da-agent path (unlike AO's `question`
// pendingInteraction type, which da-agent's controller has no equivalent of — see
// chat-backend.js's AO-only actions). On da-agent, this degrades to the model asking a
// plain-text clarifying question, already covered by the most basic assistant-message
// rendering tests — nothing distinct to add here without padding.
