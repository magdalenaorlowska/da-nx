import { expect } from '@esm-bundle/chai';
import ChatBackend from '../../../../nx2/blocks/chat/chat-backend.js';
import { AGENT_EVENT, TOOL_NAME, TOOL_STATE } from '../../../../nx2/blocks/chat/constants.js';

// Tier-1 contract/flow tests for scenarios.md §2 "Uploads & Images" (scenarios 2.1–2.4).
// All four are grounded in da-agent's content_upload tool and the da-agent path only.
//
// content_upload never appears in the "needs approval" list (scenarios.md §1 Coverage
// Notes / §6): unlike content_create/update/delete/move, it executes without a
// pendingInteraction — confirmed by omission from TOOL_NAME's approval-required set.
//
// Not exercised here (server-side / DOM-only, out of scope for a client contract test):
// - resolveAttachmentByRef's null-check and the page-relative dot-folder convention are
//   da-agent (src/tools/tools.ts, src/prompt-builder.ts) — this file only asserts that
//   the client faithfully displays whatever errorText the server sends (2.3).
// - _onFilesSelected/drag-drop (chat.js) turn a raw File into a sendMessage attachment;
//   that's DOM/FileReader plumbing, not part of the neutral controller/backend contract.

function makeBackend() {
  const updates = [];
  const backend = new ChatBackend(false, { onUpdate: (u) => updates.push(u) });
  const c = backend._controller;
  c._messages = [];
  // sendMessage requires a connection and calls the real _stream(), which performs a
  // network fetch — stub it like chat-controller.test.js's seedTwoAwaiting() does, so the
  // synchronous message/attachment bookkeeping in sendMessage is exercised for real while
  // the (out of scope here) network round-trip is not.
  c._connected = true;
  c._stream = async () => {};
  return { backend, updates, c };
}

describe('2.1 Upload an attached image and place it in a page', () => {
  it('attaches the file via sendMessage, then resolves the content_upload tool call by attachmentRef', async () => {
    const { updates, c } = makeBackend();
    const attachment = {
      id: 'a1', fileName: 'hero.jpg', mediaType: 'image/jpeg', sizeBytes: 2048, dataBase64: 'BASE64DATA',
    };

    await c.sendMessage('Use this as the hero image on this page.', [], { attachments: [attachment] });

    // sendMessage strips dataBase64 out of the persisted message (attachmentsMeta),
    // but keeps it in _pendingAttachments — that's what actually goes out over the wire.
    const userMessage = c._messages.at(-1);
    expect(userMessage.attachmentsMeta).to.deep.equal([
      { id: 'a1', fileName: 'hero.jpg', mediaType: 'image/jpeg', sizeBytes: 2048 },
    ]);
    expect(c._pendingAttachments).to.deep.equal([attachment]);

    c._onToolEvent({
      type: AGENT_EVENT.TOOL_INPUT_AVAILABLE,
      toolCallId: 't1',
      toolName: TOOL_NAME.CONTENT_UPLOAD,
      input: { attachmentRef: 'a1', path: '/products/.fall-launch/hero.jpg' },
    });
    c._onToolEvent({
      type: AGENT_EVENT.TOOL_OUTPUT_AVAILABLE, toolCallId: 't1', output: { path: '/products/.fall-launch/hero.jpg' },
    });

    const last = updates.at(-1);
    expect(last.pendingInteraction).to.equal(null);
    expect(last.toolCards.get('t1').state).to.equal(TOOL_STATE.OUTPUT_AVAILABLE);
  });
});

describe('2.2 Upload a standalone media asset', () => {
  it('resolves content_upload against a media/ destination path with no approval gate', () => {
    const { updates, c } = makeBackend();
    c._onToolEvent({
      type: AGENT_EVENT.TOOL_INPUT_AVAILABLE,
      toolCallId: 't1',
      toolName: TOOL_NAME.CONTENT_UPLOAD,
      input: { attachmentRef: 'a1', path: 'media/logo.png' },
    });
    c._onToolEvent({ type: AGENT_EVENT.TOOL_OUTPUT_AVAILABLE, toolCallId: 't1', output: { path: 'media/logo.png' } });

    const last = updates.at(-1);
    expect(last.pendingInteraction).to.equal(null);
    expect(last.toolCards.get('t1').state).to.equal(TOOL_STATE.OUTPUT_AVAILABLE);
    expect(c._findToolPart('t1').input.path).to.equal('media/logo.png');
  });
});

describe('2.3 Attachment reference resolution failure', () => {
  // The null-check itself (resolveAttachmentByRef) is server-side; this asserts the
  // client's half of the contract — an error result renders as OUTPUT_ERROR with
  // whatever errorText the server sent, not a swallowed or generic failure.
  it('surfaces the server error text on the tool card rather than swallowing it', () => {
    const { updates, c } = makeBackend();
    c._onToolEvent({
      type: AGENT_EVENT.TOOL_INPUT_AVAILABLE,
      toolCallId: 't1',
      toolName: TOOL_NAME.CONTENT_UPLOAD,
      input: { attachmentRef: 'expired-ref' },
    });
    c._onToolEvent({
      type: AGENT_EVENT.TOOL_OUTPUT_ERROR,
      toolCallId: 't1',
      errorText: 'Attachment not found — please re-attach the file.',
    });

    const card = updates.at(-1).toolCards.get('t1');
    expect(card.state).to.equal(TOOL_STATE.OUTPUT_ERROR);
    expect(card.errorText).to.equal('Attachment not found — please re-attach the file.');
  });
});

describe('2.4 contentUrl swap after upload', () => {
  it('replaces dataBase64 with the returned contentUrl once content_upload succeeds', async () => {
    const { c } = makeBackend();
    const attachment = { id: 'a1', fileName: 'hero.jpg', mediaType: 'image/jpeg', sizeBytes: 2048, dataBase64: 'BASE64DATA' };
    await c.sendMessage('Use this as the hero image.', [], { attachments: [attachment] });

    c._onToolEvent({
      type: AGENT_EVENT.TOOL_INPUT_AVAILABLE,
      toolCallId: 't1',
      toolName: TOOL_NAME.CONTENT_UPLOAD,
      input: { attachmentRef: 'a1', path: '/products/.fall-launch/hero.jpg' },
    });
    c._onToolEvent({
      type: AGENT_EVENT.TOOL_OUTPUT_AVAILABLE,
      toolCallId: 't1',
      output: { source: { contentUrl: 'https://content.da.live/acme/site/products/.fall-launch/hero.jpg' } },
    });

    expect(c._pendingAttachments).to.deep.equal([{
      id: 'a1',
      fileName: 'hero.jpg',
      mediaType: 'image/jpeg',
      contentUrl: 'https://content.da.live/acme/site/products/.fall-launch/hero.jpg',
      sizeBytes: 2048,
    }]);
    // dataBase64 must be gone — that's the whole point of the swap (no re-sending raw bytes).
    expect(c._pendingAttachments[0]).to.not.have.property('dataBase64');
  });
});
