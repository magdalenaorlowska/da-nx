import { expect } from '@esm-bundle/chai';
import ChatBackend from '../../../../nx2/blocks/chat/chat-backend.js';
import '../../../../nx2/blocks/chat/interaction/interaction.js';
import { AGENT_EVENT, TOOL_STATE } from '../../../../nx2/blocks/chat/constants.js';

// Tier-1 contract/flow tests for scenarios.md §6 "Approval Flows" (scenarios 6.1–6.6),
// da-agent path.
//
// 6.1 "Approve a destructive action", 6.2 "Reject an action", and 6.3 "Always-approve a
// tool for the rest of the session" are already fully covered, pre-existing, by
// chat-controller.test.js's "chat-controller approveToolCall (batching)" suite — it
// drives the exact same approveToolCall()/_pendingUnsent()/_autoApprovedTools mechanism
// these three scenarios describe. Not duplicated here.
//
// This file covers what that suite doesn't: 6.4 (keyboard shortcuts, which live in
// interaction.js, not the controller), 6.5, and 6.6.

function makeBackend() {
  const updates = [];
  const backend = new ChatBackend(false, { onUpdate: (u) => updates.push(u) });
  backend._controller._messages = [];
  return { backend, updates };
}

function makeInteraction(pending, callbacks = {}) {
  const el = document.createElement('nx-chat-interaction');
  el.pending = pending;
  Object.assign(el, callbacks);
  document.body.appendChild(el);
  return el;
}

function press(key, opts = {}) {
  document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...opts }));
}

describe('6.4 Keyboard-driven approval', () => {
  let el;
  afterEach(() => el?.remove());

  it('Enter approves', async () => {
    const calls = [];
    el = makeInteraction(
      { type: 'approval', toolCallId: 't1', toolName: 'content_delete', summary: '/a' },
      { onApprove: (...args) => calls.push(args) },
    );
    await el.updateComplete;
    press('Enter');
    expect(calls).to.deep.equal([['t1', true]]);
  });

  it('Escape rejects', async () => {
    const calls = [];
    el = makeInteraction(
      { type: 'approval', toolCallId: 't1', toolName: 'content_delete', summary: '/a' },
      { onApprove: (...args) => calls.push(args) },
    );
    await el.updateComplete;
    press('Escape');
    expect(calls).to.deep.equal([['t1', false]]);
  });

  it('⌘+Enter always-approves', async () => {
    const calls = [];
    el = makeInteraction(
      { type: 'approval', toolCallId: 't1', toolName: 'content_delete', summary: '/a' },
      { onApprove: (...args) => calls.push(args) },
    );
    await el.updateComplete;
    press('Enter', { metaKey: true });
    expect(calls).to.deep.equal([['t1', true, true]]);
  });

  it('ignores keyboard shortcuts when nothing is pending', async () => {
    const calls = [];
    el = makeInteraction(null, { onApprove: (...args) => calls.push(args) });
    await el.updateComplete;
    press('Enter');
    press('Escape');
    expect(calls).to.deep.equal([]);
  });
});

describe('6.5 Skill save does not block on approval', () => {
  it('da_create_skill resolves without ever requesting approval', () => {
    const { backend, updates } = makeBackend();
    const c = backend._controller;
    c._onToolEvent({
      type: AGENT_EVENT.TOOL_INPUT_AVAILABLE,
      toolCallId: 't1',
      toolName: 'da_create_skill',
      input: { name: 'seo-checklist' },
    });
    c._onToolEvent({ type: AGENT_EVENT.TOOL_OUTPUT_AVAILABLE, toolCallId: 't1', output: { status: 'draft' } });

    const last = updates.at(-1);
    expect(last.pendingInteraction).to.equal(null);
    expect(last.toolCards.get('t1').state).to.equal(TOOL_STATE.OUTPUT_AVAILABLE);
  });
});

describe('6.6 Approving a new agent preset', () => {
  it('da_create_agent suspends the turn with an approval pendingInteraction', () => {
    const { backend, updates } = makeBackend();
    backend._controller._onToolEvent({
      type: AGENT_EVENT.TOOL_INPUT_AVAILABLE,
      toolCallId: 't1',
      toolName: 'da_create_agent',
      input: { name: 'seo-agent', humanReadableSummary: "Create agent preset 'seo-agent'" },
    });
    backend._controller._onToolEvent({ type: AGENT_EVENT.TOOL_APPROVAL_REQUEST, toolCallId: 't1' });

    expect(updates.at(-1).pendingInteraction).to.deep.equal({
      type: 'approval', toolCallId: 't1', toolName: 'da_create_agent', summary: "Create agent preset 'seo-agent'",
    });
  });
});
