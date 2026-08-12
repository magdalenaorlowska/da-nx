import { expect } from '@esm-bundle/chai';
import ChatBackend from '../../../../nx2/blocks/chat/chat-backend.js';
import { AGENT_EVENT, TOOL_STATE } from '../../../../nx2/blocks/chat/constants.js';

// Tier-1 contract/flow tests for scenarios.md §9 "Skills" (scenarios 9.1–9.6), da-agent
// path.
//
// - 9.1 "Load and apply a skill via slash menu" is already fully covered, pre-existing,
//   by chat.test.js (buildSlashMessage + NxChat._onSlashSelect: requestedSkills,
//   attachments, context items). Not duplicated here.
// - 9.3 "Save a newly drafted skill" (da_create_skill, no approval) is the exact same
//   tool/contract as scenario 6.5's test in 6-approval-flows.test.js — not duplicated.
// - 9.4 "[SKILL_SUGGESTION]" card: confirmed by repo-wide grep (case-insensitive, for
//   "SKILL_SUGGESTION", "skill-suggestion", "Create Skill") — zero matches anywhere in
//   da-nx. This is a real gap, not a test limitation: da-agent's prompt-builder.ts
//   describes this card, but da-nx has no renderer for it. Flagged in
//   SCENARIO-COVERAGE.md as not-automatable rather than tested against nonexistent code.
// - 9.5 "Skill not found" and 9.6 "Skills Engineer preset" have no da-nx file cited in
//   the catalogue itself, and repo-wide greps confirm no client-side handling exists for
//   either — both are pure server-side text responses (a plain assistant message),
//   already covered by the most basic message-rendering tests. Nothing distinct to add
//   without padding; marked not-automatable in SCENARIO-COVERAGE.md.

function makeBackend() {
  const updates = [];
  const backend = new ChatBackend(false, { onUpdate: (u) => updates.push(u) });
  backend._controller._messages = [];
  return { backend, updates };
}

describe('9.2 Read a skill\'s full instructions before applying it', () => {
  it('da_read_skill resolves without an approval gate', () => {
    const { backend, updates } = makeBackend();
    const c = backend._controller;
    c._onToolEvent({
      type: AGENT_EVENT.TOOL_INPUT_AVAILABLE, toolCallId: 't1', toolName: 'da_read_skill', input: { skillId: 'brand-voice' },
    });
    c._onToolEvent({
      type: AGENT_EVENT.TOOL_OUTPUT_AVAILABLE, toolCallId: 't1', output: { instructions: 'Use a warm, sensory voice...' },
    });

    const last = updates.at(-1);
    expect(last.pendingInteraction).to.equal(null);
    expect(last.toolCards.get('t1').state).to.equal(TOOL_STATE.OUTPUT_AVAILABLE);
  });
});
