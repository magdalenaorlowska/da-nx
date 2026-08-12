import { expect } from '@esm-bundle/chai';
import ChatBackend from '../../../../nx2/blocks/chat/chat-backend.js';
import { AGENT_EVENT, TOOL_STATE } from '../../../../nx2/blocks/chat/constants.js';

// Tier-1 contract/flow tests for scenarios.md §3 "Single-Page Preview & Publish (EDS)"
// (scenarios 3.1–3.3). All da-agent-path, all no-approval (per §1's Coverage Note #3:
// content_preview/content_publish/content_unpreview/content_unpublish are the four EDS
// tools explicitly flagged as mutating-but-ungated). None of the four tool names have a
// TOOL_NAME entry — the client doesn't special-case them — so they stay as plain strings,
// same as content_read/content_list in §1.
//
// content_publish's "previews first, then promotes; aborts if preview fails" is a
// server-side orchestration (da-agent src/tools/tools.ts) inside a single tool call — the
// client only ever sees one tool-input-available/tool-output-* pair either way. 3.2 tests
// the client's half of that contract: a failed publish surfaces as an error card, not a
// silently-swallowed or falsely-successful one.

function makeBackend() {
  const updates = [];
  const backend = new ChatBackend(false, { onUpdate: (u) => updates.push(u) });
  backend._controller._messages = [];
  return { backend, updates };
}

describe('3.1 Preview a page', () => {
  it('resolves content_preview with no approval gate', () => {
    const { backend, updates } = makeBackend();
    const c = backend._controller;
    c._onToolEvent({
      type: AGENT_EVENT.TOOL_INPUT_AVAILABLE, toolCallId: 't1', toolName: 'content_preview', input: { path: '/products/fall-launch' },
    });
    c._onToolEvent({
      type: AGENT_EVENT.TOOL_OUTPUT_AVAILABLE, toolCallId: 't1', output: { previewUrl: 'https://main--site--acme.aem.page/products/fall-launch' },
    });

    const last = updates.at(-1);
    expect(last.pendingInteraction).to.equal(null);
    expect(last.toolCards.get('t1').state).to.equal(TOOL_STATE.OUTPUT_AVAILABLE);
  });
});

describe('3.2 Publish a page', () => {
  it('resolves content_publish with no approval gate on success', () => {
    const { backend, updates } = makeBackend();
    const c = backend._controller;
    c._onToolEvent({
      type: AGENT_EVENT.TOOL_INPUT_AVAILABLE, toolCallId: 't1', toolName: 'content_publish', input: { path: '/products/fall-launch' },
    });
    c._onToolEvent({
      type: AGENT_EVENT.TOOL_OUTPUT_AVAILABLE, toolCallId: 't1', output: { liveUrl: 'https://main--site--acme.aem.live/products/fall-launch' },
    });

    const last = updates.at(-1);
    expect(last.pendingInteraction).to.equal(null);
    expect(last.toolCards.get('t1').state).to.equal(TOOL_STATE.OUTPUT_AVAILABLE);
  });

  it('surfaces an aborted publish (preview step failed) as an error card, not a false success', () => {
    const { backend, updates } = makeBackend();
    const c = backend._controller;
    c._onToolEvent({
      type: AGENT_EVENT.TOOL_INPUT_AVAILABLE, toolCallId: 't1', toolName: 'content_publish', input: { path: '/products/fall-launch' },
    });
    c._onToolEvent({
      type: AGENT_EVENT.TOOL_OUTPUT_ERROR, toolCallId: 't1', errorText: 'Publish aborted: preview failed.',
    });

    const card = updates.at(-1).toolCards.get('t1');
    expect(card.state).to.equal(TOOL_STATE.OUTPUT_ERROR);
    expect(card.errorText).to.equal('Publish aborted: preview failed.');
  });
});

describe('3.3 Unpreview / unpublish', () => {
  it('resolves both content_unpublish and content_unpreview with no approval gate', () => {
    const { backend, updates } = makeBackend();
    const c = backend._controller;
    c._onToolEvent({
      type: AGENT_EVENT.TOOL_INPUT_AVAILABLE, toolCallId: 't1', toolName: 'content_unpublish', input: { path: '/products/discontinued-item' },
    });
    c._onToolEvent({ type: AGENT_EVENT.TOOL_OUTPUT_AVAILABLE, toolCallId: 't1', output: { path: '/products/discontinued-item' } });
    expect(updates.at(-1).pendingInteraction).to.equal(null);

    c._onToolEvent({
      type: AGENT_EVENT.TOOL_INPUT_AVAILABLE, toolCallId: 't2', toolName: 'content_unpreview', input: { path: '/drafts/wip-page' },
    });
    c._onToolEvent({ type: AGENT_EVENT.TOOL_OUTPUT_AVAILABLE, toolCallId: 't2', output: { path: '/drafts/wip-page' } });

    const last = updates.at(-1);
    expect(last.pendingInteraction).to.equal(null);
    expect(last.toolCards.get('t1').state).to.equal(TOOL_STATE.OUTPUT_AVAILABLE);
    expect(last.toolCards.get('t2').state).to.equal(TOOL_STATE.OUTPUT_AVAILABLE);
  });
});
