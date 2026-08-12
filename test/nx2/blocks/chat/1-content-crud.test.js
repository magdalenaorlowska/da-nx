import { expect } from '@esm-bundle/chai';
import { render } from 'da-lit';
import ChatBackend from '../../../../nx2/blocks/chat/chat-backend.js';
import { renderApprovalCard } from '../../../../nx2/blocks/chat/renderers/card-renderers.js';
import { AGENT_EVENT, TOOL_NAME, TOOL_STATE } from '../../../../nx2/blocks/chat/constants.js';

// Tier-1 contract/flow tests for scenarios.md §1 "Content CRUD" (scenarios 1.1–1.9).
// All nine scenarios are grounded in da-agent's src/tools/tools.ts and are only
// exercised on the da-agent path (no AO-specific tool here) — except where noted,
// this file drives ChatController + ChatBackend directly rather than a live worker.
//
// content_read/content_list/content_version_create/content_version_list/content_media/
// content_fragment have no entry in TOOL_NAME (the client doesn't special-case them), so
// those tool names stay as plain strings; everything else uses the real constants.

function makeBackend(onToolDone) {
  const updates = [];
  const backend = new ChatBackend(false, { onUpdate: (u) => updates.push(u), onToolDone });
  // ChatController only initializes _messages in loadInitialMessages(), which these
  // flow tests skip (no live stack) — seed it directly, as chat-controller.test.js's
  // makeController() helper does.
  backend._controller._messages = [];
  return { backend, updates };
}

function mount(template) {
  const host = document.createElement('div');
  render(template, host);
  return host;
}

describe('1.1 Create a page (content_create — needs approval)', () => {
  it('suspends the turn with an approval pendingInteraction carrying the humanReadableSummary', () => {
    const { backend, updates } = makeBackend();
    backend._controller._onToolEvent({
      type: AGENT_EVENT.TOOL_INPUT_AVAILABLE,
      toolCallId: 't1',
      toolName: TOOL_NAME.CONTENT_CREATE,
      input: { path: '/products/fall-launch', humanReadableSummary: 'Create /products/fall-launch' },
    });
    backend._controller._onToolEvent({ type: AGENT_EVENT.TOOL_APPROVAL_REQUEST, toolCallId: 't1' });

    expect(updates.at(-1).pendingInteraction).to.deep.equal({
      type: 'approval', toolCallId: 't1', toolName: TOOL_NAME.CONTENT_CREATE, summary: 'Create /products/fall-launch',
    });
  });

  it('renders the approval card with the tool name and summary, wired to approve/reject', () => {
    const calls = [];
    const host = mount(renderApprovalCard(
      { toolCallId: 't1', toolName: TOOL_NAME.CONTENT_CREATE, summary: 'Create /products/fall-launch' },
      (...args) => calls.push(args),
    ));
    expect(host.querySelector('.approval-tool-name').textContent).to.equal(TOOL_NAME.CONTENT_CREATE);
    expect(host.querySelector('.approval-summary').textContent).to.equal('Create /products/fall-launch');
    host.querySelector('.approval-buttons button.action-btn').click();
    expect(calls).to.deep.equal([['t1', true]]);
  });

  it('resolves to output-available with no pendingInteraction once approved and executed', () => {
    const { backend, updates } = makeBackend();
    const c = backend._controller;
    c._onToolEvent({
      type: AGENT_EVENT.TOOL_INPUT_AVAILABLE, toolCallId: 't1', toolName: TOOL_NAME.CONTENT_CREATE, input: { path: '/products/fall-launch' },
    });
    c._onToolEvent({ type: AGENT_EVENT.TOOL_APPROVAL_REQUEST, toolCallId: 't1' });
    // Hand-patches the decided state instead of calling the real approveToolCall(), so this
    // does NOT exercise the approve/batching mechanism itself (that's scenario 6.1, "Approve
    // a destructive action", to be tested end-to-end via approveToolCall() in
    // 6-approval-flows.test.js) — only what a tool card does once a decision has landed.
    c._patchToolPart('t1', { state: TOOL_STATE.APPROVED });
    c._onToolEvent({ type: AGENT_EVENT.TOOL_OUTPUT_AVAILABLE, toolCallId: 't1', output: { path: '/products/fall-launch' } });

    const last = updates.at(-1);
    expect(last.pendingInteraction).to.equal(null);
    expect(last.toolCards.get('t1').state).to.equal(TOOL_STATE.OUTPUT_AVAILABLE);
  });
});

describe('1.2 Read a page (content_read — no approval)', () => {
  it('goes straight to output-available, never suspending the turn', () => {
    const { backend, updates } = makeBackend();
    const c = backend._controller;
    c._onToolEvent({
      type: AGENT_EVENT.TOOL_INPUT_AVAILABLE, toolCallId: 't1', toolName: 'content_read', input: { path: '/products/fall-launch' },
    });
    c._onToolEvent({
      type: AGENT_EVENT.TOOL_OUTPUT_AVAILABLE,
      toolCallId: 't1',
      output: { content: '# Fall Launch\n\nHero + intro paragraph.' },
    });

    const last = updates.at(-1);
    expect(last.pendingInteraction).to.equal(null);
    expect(last.toolCards.get('t1')).to.deep.include({ state: TOOL_STATE.OUTPUT_AVAILABLE });
    expect(last.toolCards.get('t1').output).to.deep.equal({ content: '# Fall Launch\n\nHero + intro paragraph.' });
  });
});

describe('1.3 Update a page (content_update — needs approval, requires humanReadableSummary)', () => {
  it('derives the approval summary from humanReadableSummary, not the raw diff', () => {
    const { backend, updates } = makeBackend();
    backend._controller._onToolEvent({
      type: AGENT_EVENT.TOOL_INPUT_AVAILABLE,
      toolCallId: 't1',
      toolName: TOOL_NAME.CONTENT_UPDATE,
      input: { path: '/products/fall-launch', humanReadableSummary: "Change hero headline to 'Fall Launch Is Here'" },
    });
    backend._controller._onToolEvent({ type: AGENT_EVENT.TOOL_APPROVAL_REQUEST, toolCallId: 't1' });

    expect(updates.at(-1).pendingInteraction).to.deep.equal({
      type: 'approval',
      toolCallId: 't1',
      toolName: TOOL_NAME.CONTENT_UPDATE,
      summary: "Change hero headline to 'Fall Launch Is Here'",
    });
  });
});

describe('1.4 Delete a page (content_delete — needs approval)', () => {
  it('falls back to the path field for the approval summary when no humanReadableSummary is given', () => {
    const { backend, updates } = makeBackend();
    backend._controller._onToolEvent({
      type: AGENT_EVENT.TOOL_INPUT_AVAILABLE,
      toolCallId: 't1',
      toolName: TOOL_NAME.CONTENT_DELETE,
      input: { path: '/products/discontinued-item' },
    });
    backend._controller._onToolEvent({ type: AGENT_EVENT.TOOL_APPROVAL_REQUEST, toolCallId: 't1' });

    expect(updates.at(-1).pendingInteraction.summary).to.equal('/products/discontinued-item');
  });
});

describe('1.5 List a folder (content_list — no approval)', () => {
  it('returns the folder listing with no pendingInteraction', () => {
    const { backend, updates } = makeBackend();
    const c = backend._controller;
    c._onToolEvent({
      type: AGENT_EVENT.TOOL_INPUT_AVAILABLE, toolCallId: 't1', toolName: 'content_list', input: { path: '/products' },
    });
    c._onToolEvent({
      type: AGENT_EVENT.TOOL_OUTPUT_AVAILABLE,
      toolCallId: 't1',
      output: { items: [{ path: '/products/fall-launch' }, { path: '/products/discontinued-item' }] },
    });

    const last = updates.at(-1);
    expect(last.pendingInteraction).to.equal(null);
    expect(last.toolCards.get('t1').output.items).to.have.length(2);
  });
});

describe('1.6 Copy a page (content_copy — no approval)', () => {
  // scenarios.md flags this as an inconsistency: content_copy is a mutating operation
  // (like content_create/content_move) but, unlike them, isn't approval-gated server-side.
  // Asserting today's actual (ungated) behavior here, not the behavior one might expect
  // from the "mutations need approval" pattern — see SCENARIO-COVERAGE.md for the note.
  it('executes without ever suspending the turn for approval', () => {
    const { backend, updates } = makeBackend();
    const c = backend._controller;
    c._onToolEvent({
      type: AGENT_EVENT.TOOL_INPUT_AVAILABLE,
      toolCallId: 't1',
      toolName: TOOL_NAME.CONTENT_COPY,
      input: { sourcePath: '/products/fall-launch', destinationPath: '/products/winter-launch' },
    });
    c._onToolEvent({ type: AGENT_EVENT.TOOL_OUTPUT_AVAILABLE, toolCallId: 't1', output: { path: '/products/winter-launch' } });

    const last = updates.at(-1);
    expect(last.pendingInteraction).to.equal(null);
    expect(last.toolCards.get('t1').state).to.equal(TOOL_STATE.OUTPUT_AVAILABLE);
  });
});

describe('1.7 Move / rename a page (content_move — needs approval, affects two folders)', () => {
  it('derives the approval summary as "source → destination"', () => {
    const { backend, updates } = makeBackend();
    backend._controller._onToolEvent({
      type: AGENT_EVENT.TOOL_INPUT_AVAILABLE,
      toolCallId: 't1',
      toolName: TOOL_NAME.CONTENT_MOVE,
      input: { sourcePath: '/products/fall-launch', destinationPath: '/campaigns/2026/fall-launch' },
    });
    backend._controller._onToolEvent({ type: AGENT_EVENT.TOOL_APPROVAL_REQUEST, toolCallId: 't1' });

    expect(updates.at(-1).pendingInteraction.summary).to.equal('/products/fall-launch → /campaigns/2026/fall-launch');
  });

  it('reports both the source and destination parent folders as affected once executed', () => {
    const done = [];
    const { backend } = makeBackend((scope, folders) => done.push([scope, folders]));
    const c = backend._controller;
    const input = {
      org: 'acme', repo: 'site', sourcePath: '/products/fall-launch', destinationPath: '/campaigns/2026/fall-launch',
    };
    c._onToolEvent({ type: AGENT_EVENT.TOOL_INPUT_AVAILABLE, toolCallId: 't1', toolName: TOOL_NAME.CONTENT_MOVE, input });
    c._onToolEvent({ type: AGENT_EVENT.TOOL_APPROVAL_REQUEST, toolCallId: 't1' });
    // See the note in 1.1's "resolves to output-available..." test above — same shortcut,
    // same reason (real approveToolCall() flow is scenario 6.1, not this one).
    c._patchToolPart('t1', { state: TOOL_STATE.APPROVED });
    c._onToolEvent({
      type: AGENT_EVENT.TOOL_OUTPUT_AVAILABLE, toolCallId: 't1', output: {}, scope: 'file',
    });

    expect(done).to.deep.equal([
      ['file', ['/acme/site/products', '/acme/site/campaigns/2026']],
    ]);
  });
});

describe('1.8 Version history (content_version_create + content_version_list — no approval)', () => {
  it('creates a version then lists history, neither suspending the turn', () => {
    const { backend, updates } = makeBackend();
    const c = backend._controller;
    c._onToolEvent({
      type: AGENT_EVENT.TOOL_INPUT_AVAILABLE,
      toolCallId: 't1',
      toolName: 'content_version_create',
      input: { path: '/products/fall-launch', label: 'before Q4 copy refresh' },
    });
    c._onToolEvent({ type: AGENT_EVENT.TOOL_OUTPUT_AVAILABLE, toolCallId: 't1', output: { versionId: 'v1' } });
    expect(updates.at(-1).pendingInteraction).to.equal(null);

    c._onToolEvent({
      type: AGENT_EVENT.TOOL_INPUT_AVAILABLE,
      toolCallId: 't2',
      toolName: 'content_version_list',
      input: { path: '/products/fall-launch' },
    });
    c._onToolEvent({
      type: AGENT_EVENT.TOOL_OUTPUT_AVAILABLE,
      toolCallId: 't2',
      output: { versions: [{ versionId: 'v1', label: 'before Q4 copy refresh' }] },
    });

    const last = updates.at(-1);
    expect(last.pendingInteraction).to.equal(null);
    expect(last.toolCards.get('t2').output.versions).to.have.length(1);
  });
});

describe('1.9 Media / fragment lookup (content_media + content_fragment — no approval)', () => {
  it('resolves both lookups in the same turn without an approval gate', () => {
    const { backend, updates } = makeBackend();
    const c = backend._controller;
    c._onToolEvent({
      type: AGENT_EVENT.TOOL_INPUT_AVAILABLE,
      toolCallId: 't1',
      toolName: 'content_media',
      input: { path: '/media/hero-banner.png' },
    });
    c._onToolEvent({ type: AGENT_EVENT.TOOL_OUTPUT_AVAILABLE, toolCallId: 't1', output: { usedBy: ['/products/fall-launch'] } });

    c._onToolEvent({
      type: AGENT_EVENT.TOOL_INPUT_AVAILABLE,
      toolCallId: 't2',
      toolName: 'content_fragment',
      input: { path: '/fragments/footer-cta' },
    });
    c._onToolEvent({ type: AGENT_EVENT.TOOL_OUTPUT_AVAILABLE, toolCallId: 't2', output: { referencedBy: ['/products/fall-launch'] } });

    const last = updates.at(-1);
    expect(last.pendingInteraction).to.equal(null);
    expect(last.toolCards.get('t1').output.usedBy).to.deep.equal(['/products/fall-launch']);
    expect(last.toolCards.get('t2').output.referencedBy).to.deep.equal(['/products/fall-launch']);
  });
});
