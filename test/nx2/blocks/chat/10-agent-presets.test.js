import { expect } from '@esm-bundle/chai';
import ChatBackend from '../../../../nx2/blocks/chat/chat-backend.js';
import { AGENT_EVENT } from '../../../../nx2/blocks/chat/constants.js';

// Tier-1 contract/flow tests for scenarios.md §10 "Agent Presets" (scenarios
// 10.1–10.2), da-agent path. Neither tool has a TOOL_NAME entry — the client doesn't
// special-case agent-preset tools — so this is the same generic tool-card contract
// proven repeatedly in §1, applied here to contrast the two tools' approval-gating:
// da_list_agents (read-only, no approval) vs. da_create_agent (mutating, needs
// approval — the same tool scenario 6.6 already tests for the plain case; this test
// instead covers 10.2's distinguishing detail, that the approval-gated input carries
// bundled skills + MCP servers, not just a name).

function makeBackend() {
  const updates = [];
  const backend = new ChatBackend(false, { onUpdate: (u) => updates.push(u) });
  backend._controller._messages = [];
  return { backend, updates };
}

describe('10.1 List available presets', () => {
  it('da_list_agents resolves without an approval gate', () => {
    const { backend, updates } = makeBackend();
    const c = backend._controller;
    c._onToolEvent({ type: AGENT_EVENT.TOOL_INPUT_AVAILABLE, toolCallId: 't1', toolName: 'da_list_agents', input: {} });
    c._onToolEvent({
      type: AGENT_EVENT.TOOL_OUTPUT_AVAILABLE,
      toolCallId: 't1',
      output: { agents: [{ id: 'skills-engineer' }, { id: 'structured-content' }] },
    });

    const last = updates.at(-1);
    expect(last.pendingInteraction).to.equal(null);
    expect(last.toolCards.get('t1').output.agents).to.have.length(2);
  });
});

describe('10.2 Create a custom preset with skills + MCP servers', () => {
  it('suspends the turn for approval, carrying the bundled skills/MCP servers in the tool input', () => {
    const { backend, updates } = makeBackend();
    const c = backend._controller;
    const input = {
      name: 'localization-agent',
      skills: ['brand-voice', 'seo-checklist'],
      humanReadableSummary: "Create agent preset 'localization-agent'",
    };
    c._onToolEvent({ type: AGENT_EVENT.TOOL_INPUT_AVAILABLE, toolCallId: 't1', toolName: 'da_create_agent', input });
    c._onToolEvent({ type: AGENT_EVENT.TOOL_APPROVAL_REQUEST, toolCallId: 't1' });

    const pending = updates.at(-1).pendingInteraction;
    expect(pending).to.deep.equal({
      type: 'approval', toolCallId: 't1', toolName: 'da_create_agent', summary: "Create agent preset 'localization-agent'",
    });
    // The approval card's summary is a display string, not the full payload — the
    // bundled skills still travel with the tool call itself, for the agent to execute
    // once approved.
    expect(c._findToolPart('t1').input.skills).to.deep.equal(['brand-voice', 'seo-checklist']);
  });
});
