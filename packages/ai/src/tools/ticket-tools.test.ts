import { describe, expect, it, vi } from 'vitest';
import { createTicketTools, deriveCommentId, type TicketMutationClient } from './ticket-tools.js';

function makeClient(): TicketMutationClient & {
  createComment: ReturnType<typeof vi.fn>;
  updateTicket: ReturnType<typeof vi.fn>;
} {
  return {
    createComment: vi.fn().mockImplementation(async (ticketId, _body, options) => ({
      id: options?.id ?? 'random-id-from-client',
      ticketId,
    })),
    updateTicket: vi.fn().mockResolvedValue({ id: 'tkt', status: 'done' }),
  };
}

describe('deriveCommentId', () => {
  it('produces a stable id for the same inputs', () => {
    expect(deriveCommentId('dispatch-1', 0)).toBe(deriveCommentId('dispatch-1', 0));
  });

  it('differs across ordinals within the same dispatch', () => {
    expect(deriveCommentId('dispatch-1', 0)).not.toBe(deriveCommentId('dispatch-1', 1));
  });

  it('differs across dispatches', () => {
    expect(deriveCommentId('dispatch-1', 0)).not.toBe(deriveCommentId('dispatch-2', 0));
  });

  it('starts with the cmt_ prefix and is 36 chars total', () => {
    const id = deriveCommentId('dispatch-x', 5);
    expect(id).toMatch(/^cmt_[0-9a-f]{32}$/);
    expect(id).toHaveLength(36);
  });
});

describe('createTicketTools — add_ticket_comment', () => {
  it('passes no options to createComment when dispatchId is absent', async () => {
    const client = makeClient();
    const [, addComment] = createTicketTools('tkt-1', client);
    expect(addComment).toBeDefined();
    await addComment?.execute({ text: 'hello' });

    expect(client.createComment).toHaveBeenCalledTimes(1);
    const [ticketId, body, opts] = client.createComment.mock.calls[0] as [
      string,
      Record<string, unknown>,
      unknown,
    ];
    expect(ticketId).toBe('tkt-1');
    expect(body).toMatchObject({ type: 'doc' });
    expect(opts).toBeUndefined();
  });

  it('passes a deterministic id when dispatchId is present', async () => {
    const client = makeClient();
    const [, addComment] = createTicketTools('tkt-1', client, { dispatchId: 'job-42' });
    await addComment?.execute({ text: 'first' });

    const [, , opts] = client.createComment.mock.calls[0] as [
      string,
      Record<string, unknown>,
      { id: string } | undefined,
    ];
    expect(opts?.id).toBe(deriveCommentId('job-42', 0));
  });

  it('increments the call ordinal across multiple invocations in a single dispatch', async () => {
    const client = makeClient();
    const [, addComment] = createTicketTools('tkt-1', client, { dispatchId: 'job-42' });
    await addComment?.execute({ text: 'first' });
    await addComment?.execute({ text: 'second' });
    await addComment?.execute({ text: 'third' });

    const ids = client.createComment.mock.calls.map(
      (call) => (call[2] as { id?: string } | undefined)?.id,
    );
    expect(ids).toEqual([
      deriveCommentId('job-42', 0),
      deriveCommentId('job-42', 1),
      deriveCommentId('job-42', 2),
    ]);
  });

  it('resets ordinal in a fresh createTicketTools call (crash-resume behavior)', async () => {
    // Simulates: first dispatch crashes after one comment. Second
    // dispatch (resume) calls createTicketTools again with the same
    // dispatchId. Each fresh invocation starts at ordinal 0, so the
    // first comment of the resume has the same id as the first comment
    // of the original run — DB PK constraint will dedupe.
    const client1 = makeClient();
    const [, addComment1] = createTicketTools('tkt-1', client1, { dispatchId: 'job-42' });
    await addComment1?.execute({ text: 'first attempt' });
    const firstRunId = (client1.createComment.mock.calls[0]?.[2] as { id: string } | undefined)?.id;

    const client2 = makeClient();
    const [, addComment2] = createTicketTools('tkt-1', client2, { dispatchId: 'job-42' });
    await addComment2?.execute({ text: 'second attempt' });
    const secondRunId = (client2.createComment.mock.calls[0]?.[2] as { id: string } | undefined)
      ?.id;

    expect(firstRunId).toBe(secondRunId);
    expect(firstRunId).toBe(deriveCommentId('job-42', 0));
  });

  it('surfaces a failure when createComment returns null', async () => {
    const client = makeClient();
    client.createComment.mockResolvedValueOnce(null);
    const [, addComment] = createTicketTools('tkt-1', client, { dispatchId: 'job-42' });
    const result = await addComment?.execute({ text: 'whatever' });
    expect(result).toEqual({ success: false, error: 'Failed to create comment' });
  });
});
