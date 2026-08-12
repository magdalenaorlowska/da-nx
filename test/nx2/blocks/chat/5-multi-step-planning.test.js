import { expect } from '@esm-bundle/chai';
import { render } from 'da-lit';
import ChatBackend from '../../../../nx2/blocks/chat/chat-backend.js';
import { renderMessage } from '../../../../nx2/blocks/chat/renderers/renderers.js';
import '../../../../nx2/blocks/chat/messages/campaign-plan-card.js';
import { AGENT_EVENT, TOOL_NAME, TOOL_STATE } from '../../../../nx2/blocks/chat/constants.js';

// Tier-1 contract/flow tests for scenarios.md §5 "Multi-Step Planning" (scenarios
// 5.1–5.4), da-agent path.
//
// Much of 5.1/5.2's client contract is already covered by pre-existing tests, not
// duplicated here:
// - chat-backend.test.js: "does NOT surface exit_plan_mode as a generic approval"
//   (the ChatBackend-level exclusion from the bottom approval popover).
// - renderers.test.js "renderers da-agent tool cards": exit_plan_mode always renders
//   <nx-campaign-plan-card> (even AWAITING_APPROVAL), Run wired to onApprove(id, true),
//   and :::task-item merging into the card's task statuses.
// This file adds what neither of those cover: enter_plan_mode's signal-only lifecycle,
// the Run button's disabled-while-running/done guard (only one execution per plan),
// the collapsed running-task view, and the standalone :::task-list directive.

function makeBackend() {
  const updates = [];
  const backend = new ChatBackend(false, { onUpdate: (u) => updates.push(u) });
  backend._controller._messages = [];
  return { backend, updates };
}

function mount(template) {
  const host = document.createElement('div');
  render(template, host);
  return host;
}

function makePlanCard(plan) {
  const el = document.createElement('nx-campaign-plan-card');
  el.plan = plan;
  document.body.appendChild(el);
  return el;
}

describe('5.1 Plan and run a multi-step request', () => {
  it('enter_plan_mode resolves as a signal with no approval gate', () => {
    const { backend, updates } = makeBackend();
    const c = backend._controller;
    c._onToolEvent({
      type: AGENT_EVENT.TOOL_INPUT_AVAILABLE, toolCallId: 'p0', toolName: TOOL_NAME.ENTER_PLAN_MODE, input: {},
    });
    expect(updates.at(-1).pendingInteraction).to.equal(null);

    c._onToolEvent({ type: AGENT_EVENT.TOOL_OUTPUT_AVAILABLE, toolCallId: 'p0', output: {} });

    const last = updates.at(-1);
    expect(last.pendingInteraction).to.equal(null);
    expect(last.toolCards.get('p0').state).to.equal(TOOL_STATE.OUTPUT_AVAILABLE);
  });

  it('never suspends the turn generically across enter_plan_mode → exit_plan_mode', () => {
    const { backend, updates } = makeBackend();
    const c = backend._controller;
    c._onToolEvent({
      type: AGENT_EVENT.TOOL_INPUT_AVAILABLE, toolCallId: 'p0', toolName: TOOL_NAME.ENTER_PLAN_MODE, input: {},
    });
    c._onToolEvent({ type: AGENT_EVENT.TOOL_OUTPUT_AVAILABLE, toolCallId: 'p0', output: {} });
    c._onToolEvent({
      type: AGENT_EVENT.TOOL_INPUT_AVAILABLE,
      toolCallId: 'p1',
      toolName: TOOL_NAME.EXIT_PLAN_MODE,
      input: { title: 'Fall lineup', tasks: [{ id: '1', label: 'Create /products/a', status: 'pending' }] },
    });
    c._onToolEvent({ type: AGENT_EVENT.TOOL_APPROVAL_REQUEST, toolCallId: 'p1' });

    // exit_plan_mode owns its own approval via the inline Run button — see
    // chat-backend.test.js for the dedicated exclusion test.
    expect(updates.at(-1).pendingInteraction).to.equal(null);
  });
});

describe('5.2 Run button gating', () => {
  // Run→approve wiring itself is covered in renderers.test.js. This is the guard that
  // makes Run a one-shot action: once a plan is running or done, the button can no
  // longer dispatch nx-plan-run at all.
  it('disables Run (and stops relabeling it) once a task is running', async () => {
    const card = makePlanCard({
      title: 'Fall lineup',
      tasks: [
        { id: '1', label: 'Create /products/a', status: 'done' },
        { id: '2', label: 'Create /products/b', status: 'running' },
        { id: '3', label: 'Create /products/c', status: 'pending' },
      ],
    });
    await card.updateComplete;
    const runBtn = card.shadowRoot.querySelector('.plan-btn-run');
    expect(runBtn.disabled).to.equal(true);
    expect(runBtn.textContent.trim()).to.equal('Running...');
    card.remove();
  });

  it('disables Run and shows Done once every task has completed', async () => {
    const card = makePlanCard({
      title: 'Fall lineup',
      tasks: [
        { id: '1', label: 'Create /products/a', status: 'done' },
        { id: '2', label: 'Create /products/b', status: 'done' },
      ],
    });
    await card.updateComplete;
    const runBtn = card.shadowRoot.querySelector('.plan-btn-run');
    expect(runBtn.disabled).to.equal(true);
    expect(runBtn.textContent.trim()).to.equal('Done');
    card.remove();
  });
});

describe('5.3 Collapsed running-task view', () => {
  it('shows current/total progress and only the running task while collapsed', async () => {
    const card = makePlanCard({
      title: 'Fall lineup',
      tasks: [
        { id: '1', label: 'Create /products/a', status: 'done' },
        { id: '2', label: 'Create /products/b', status: 'running' },
        { id: '3', label: 'Create /products/c', status: 'pending' },
      ],
    });
    await card.updateComplete;

    const collapsed = card.shadowRoot.querySelector('.plan-tasks-collapsed');
    expect(collapsed.querySelector('.plan-tasks-progress').textContent).to.equal('2/3');
    const collapsedItem = collapsed.querySelector('nx-task-item');
    expect(collapsedItem.getAttribute('label')).to.equal('Create /products/b');
    expect(collapsedItem.hasAttribute('truncate')).to.equal(true);

    // The full task list still renders underneath — collapsed is additive, not a replacement.
    const fullItems = [...card.shadowRoot.querySelectorAll('.plan-tasks:not(.plan-tasks-collapsed) nx-task-item')];
    expect(fullItems).to.have.length(3);
    card.remove();
  });

  it('renders no collapsed view when nothing is running', async () => {
    const card = makePlanCard({
      title: 'Fall lineup',
      tasks: [{ id: '1', label: 'Create /products/a', status: 'pending' }],
    });
    await card.updateComplete;
    expect(card.shadowRoot.querySelector('.plan-tasks-collapsed')).to.equal(null);
    card.remove();
  });
});

describe('5.4 Standalone task list (no plan card)', () => {
  it('renders a :::task-list directive as nx-task-list, not a plan card', () => {
    const directive = ':::task-list\n{"tasks":[{"id":"1","label":"Draft hero copy","status":"running"}]}\n:::';
    const host = mount(renderMessage({ role: 'assistant', content: directive }));

    expect(host.querySelector('nx-campaign-plan-card')).to.equal(null);
    const list = host.querySelector('nx-task-list');
    expect(list).to.exist;
    expect(list.tasks).to.deep.equal([{ id: '1', label: 'Draft hero copy', status: 'running' }]);
  });
});
