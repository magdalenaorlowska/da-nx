import { expect } from '@esm-bundle/chai';
import { render } from 'da-lit';
import ChatBackend from '../../../../nx2/blocks/chat/chat-backend.js';
import { renderMessage } from '../../../../nx2/blocks/chat/renderers/renderers.js';
import { renderContinuationCard } from '../../../../nx2/blocks/chat/renderers/card-renderers.js';
import '../../../../nx2/blocks/chat/interaction/interaction.js';
import {
  AGENT_EVENT, PART_TYPE, TOOL_NAME, TOOL_STATE,
} from '../../../../nx2/blocks/chat/constants.js';

// Tier-1 contract/flow tests for scenarios.md §7 "Governance / Page Evaluation +
// Continuation Gate" (scenarios 7.1–7.4), da-agent path.
//
// Already covered, pre-existing, not duplicated here:
// - renderers.test.js: evaluate_page output renders as <nx-governance-evaluation-card>.
// - messages/governance-evaluation-card.test.js: 7.2's whole drill-down contract
//   (auto-open on "NO" alignment, reasoning/suggestions, image evaluations grouped
//   with their own badge) — extensive, dedicated coverage already exists.
// - chat-backend.test.js: derives a `{type:'continuation'}` pendingInteraction from a
//   continuation-pending tool card.
// - chat-controller.test.js "continuation gate": CONTINUATION event flags the card,
//   unknown-toolCallId is a no-op, stopExecution records a user message and clears it.
//
// 7.3 ("always use the Live Preview URL for evaluation") is a pure server-side
// instruction (da-agent src/mcp/built-in-servers.ts) with no client-observable
// difference — not automatable at this boundary.

function renderTool(toolCallId, toolCards, opts) {
  const host = document.createElement('div');
  const msg = { role: 'assistant', content: [{ type: PART_TYPE.TOOL, toolCallId }] };
  render(renderMessage(msg, toolCards, opts), host);
  return host;
}

function makeBackend() {
  const updates = [];
  const backend = new ChatBackend(false, { onUpdate: (u) => updates.push(u) });
  backend._controller._messages = [];
  return { backend, updates };
}

describe('7.1 Evaluate a page against brand guidelines', () => {
  it('shows a loading governance card before the evaluation resolves', () => {
    const toolCards = new Map([['e1', { toolName: TOOL_NAME.EVALUATE_PAGE, input: {}, state: TOOL_STATE.INPUT_AVAILABLE }]]);
    const host = renderTool('e1', toolCards, {});
    const card = host.querySelector('nx-governance-evaluation-card');
    expect(card).to.exist;
    expect(card.loading).to.equal(true);
    expect(card.evaluation).to.equal(undefined);
  });

  it('shows the parsed result once output is available, no longer loading', () => {
    const output = {
      evaluations: [], successful_checks: 0, failed_checks: 0, not_applicable_checks: 0,
    };
    const toolCards = new Map([['e1', {
      toolName: TOOL_NAME.EVALUATE_PAGE, input: {}, state: TOOL_STATE.OUTPUT_AVAILABLE, output,
    }]]);
    const card = renderTool('e1', toolCards, {}).querySelector('nx-governance-evaluation-card');
    expect(card.loading).to.equal(false);
    expect(card.evaluation).to.deep.equal(output);
  });

  it('surfaces a failed evaluation as an error, not a blank/loading card', () => {
    const toolCards = new Map([['e1', {
      toolName: TOOL_NAME.EVALUATE_PAGE, input: {}, state: TOOL_STATE.OUTPUT_ERROR, output: { error: 'MCP timeout' },
    }]]);
    const card = renderTool('e1', toolCards, {}).querySelector('nx-governance-evaluation-card');
    expect(card.loading).to.equal(false);
    expect(card.error).to.equal('MCP timeout');
  });

  it('falls back to a generic error message when the server sends no error string', () => {
    const toolCards = new Map([['e1', { toolName: TOOL_NAME.EVALUATE_PAGE, input: {}, state: TOOL_STATE.OUTPUT_ERROR, output: {} }]]);
    const card = renderTool('e1', toolCards, {}).querySelector('nx-governance-evaluation-card');
    expect(card.error).to.equal('Page evaluation failed.');
  });
});

describe('7.4 Continuation gate — Continue/Stop', () => {
  // Flagged per scenarios.md: the server-side gate that would trigger this
  // (`continuationApprovalPatterns: ['evaluate_*']`) is currently commented out in
  // da-agent. These tests prove the client's contract is intact and ready — they do
  // NOT prove any live path exercises it today. See SCENARIO-COVERAGE.md.

  it('continueExecution clears the pending flag and re-streams the current turn', async () => {
    const { backend, updates } = makeBackend();
    const c = backend._controller;
    c._messages = [{
      role: 'assistant',
      content: [{ type: PART_TYPE.TOOL, toolCallId: 'e1', toolName: TOOL_NAME.EVALUATE_PAGE, state: TOOL_STATE.OUTPUT_AVAILABLE, output: {} }],
    }];
    c._onToolEvent({ type: AGENT_EVENT.CONTINUATION, toolCallId: 'e1' });
    expect(updates.at(-1).pendingInteraction).to.deep.equal({ type: 'continuation', toolCallId: 'e1' });

    const streamCalls = [];
    c._connected = true;
    c._stream = async () => { streamCalls.push(true); };
    await c.continueExecution();

    expect(streamCalls).to.have.lengthOf(1);
    expect(updates.at(-1).pendingInteraction).to.equal(null);
  });

  it('renders the Continue/Stop card wired to onContinue/onStop', () => {
    const calls = [];
    const host = document.createElement('div');
    render(renderContinuationCard(() => calls.push('continue'), () => calls.push('stop')), host);
    expect(host.querySelector('.approval-tool-name').textContent).to.equal('Review the results before continuing');
    const [stopBtn, continueBtn] = [...host.querySelectorAll('.approval-buttons button')];
    stopBtn.click();
    continueBtn.click();
    expect(calls).to.deep.equal(['stop', 'continue']);
  });

  it('wires Enter/Escape through nx-chat-interaction when a continuation is pending', async () => {
    const calls = [];
    const el = document.createElement('nx-chat-interaction');
    el.pending = { type: 'continuation', toolCallId: 'e1' };
    el.onContinue = () => calls.push('continue');
    el.onStop = () => calls.push('stop');
    document.body.appendChild(el);
    await el.updateComplete;

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    expect(calls).to.deep.equal(['continue', 'stop']);
    el.remove();
  });
});
