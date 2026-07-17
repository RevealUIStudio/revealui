/**
 * Task Submission Sync Mutation Route (by ID)
 *
 * PATCH /api/sync/task-submissions/:id  -  Update a task submission's status
 * DELETE /api/sync/task-submissions/:id  -  Delete a task submission
 *
 * Authenticated, owner-scoped. Mirrors the revmarket API's cancellation
 * policy (POST /api/revmarket/tasks/:id/cancel): non-admin users may only
 * cancel their own pending/queued tasks. Running transitions are
 * executor-owned: a running task cannot be moved to any other status through
 * this route by anyone, admins included, because that races the executor's
 * status='running' completion CAS and destroys the run's audit row (GAP-352).
 * Via this route only a pending/queued task may be cancelled, by its owner or
 * an admin. Deletion is owner-or-admin; non-admins may only delete unbilled
 * tasks that are not running or completed.
 */

import { getSession } from '@revealui/auth/server';
import { getClient } from '@revealui/db';
import { taskSubmissions } from '@revealui/db/schema';
import { logger } from '@revealui/utils/logger';
import { eq } from 'drizzle-orm';
import { type NextRequest, NextResponse } from 'next/server';
import {
  createApplicationErrorResponse,
  createErrorResponse,
  createValidationErrorResponse,
} from '@/lib/utils/error-response';
import { isSyncIdentifier } from '@/lib/utils/identifier-validation';
import { extractRequestContext } from '@/lib/utils/request-context';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const VALID_TASK_STATUSES = new Set([
  'pending',
  'queued',
  'running',
  'completed',
  'failed',
  'cancelled',
]);
const CANCELLABLE_STATUSES = new Set(['pending', 'queued']);

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const session = await getSession(request.headers, extractRequestContext(request));
    if (!session) {
      return createApplicationErrorResponse('Unauthorized', 'UNAUTHORIZED', 401);
    }

    const { id } = await params;
    if (!isSyncIdentifier(id)) {
      return createValidationErrorResponse(
        'id must be alphanumeric with hyphens/underscores',
        'id',
        id,
      );
    }

    const body = (await request.json()) as { status?: string };

    if (body.status === undefined) {
      return createValidationErrorResponse('status is required', 'status', body.status);
    }

    if (!VALID_TASK_STATUSES.has(body.status)) {
      return createValidationErrorResponse(
        `status must be one of: ${[...VALID_TASK_STATUSES].join(', ')}`,
        'status',
        body.status,
      );
    }

    const db = getClient();
    const [task] = await db
      .select({ submitterId: taskSubmissions.submitterId, status: taskSubmissions.status })
      .from(taskSubmissions)
      .where(eq(taskSubmissions.id, id))
      .limit(1);

    if (!task) {
      return createApplicationErrorResponse('Task not found', 'NOT_FOUND', 404);
    }

    if (session.user.role !== 'admin') {
      if (task.submitterId !== session.user.id) {
        return createApplicationErrorResponse('Forbidden', 'FORBIDDEN', 403);
      }
      if (body.status !== 'cancelled') {
        return createApplicationErrorResponse(
          'Only cancellation is allowed for your own tasks',
          'FORBIDDEN',
          403,
        );
      }
    }

    // Running transitions are executor-owned, enforced for everyone including
    // admins. The executor moves a task off 'running' via its status='running'
    // completion CAS (revmarket-executor.ts completeTask); moving a running
    // task to ANY other status through this route (cancelled, completed,
    // failed) races that CAS, so the CAS then finds no row and skips the audit
    // write, silently destroying the record of a run that actually happened
    // (GAP-352). A cosmetic status flip here also lies about an outcome the
    // sandbox is still producing. There is no legitimate human transition of a
    // running task via this sync route.
    if (task.status === 'running' && body.status !== 'running') {
      return createApplicationErrorResponse(
        `Cannot transition a running task to '${body.status}' here; running is executor-owned`,
        'VALIDATION_ERROR',
        400,
      );
    }

    // Cancel-state-machine policy, enforced for everyone including admins: a
    // task is only cancellable from a pending/queued state (this catches the
    // remaining non-cancellable sources, e.g. cancelling a completed/failed
    // task).
    if (body.status === 'cancelled' && !CANCELLABLE_STATUSES.has(task.status)) {
      return createApplicationErrorResponse(
        `Cannot cancel task in '${task.status}' state`,
        'VALIDATION_ERROR',
        400,
      );
    }

    const [updated] = await db
      .update(taskSubmissions)
      .set({ status: body.status, updatedAt: new Date() })
      .where(eq(taskSubmissions.id, id))
      .returning();

    if (!updated) {
      return createApplicationErrorResponse('Task not found', 'NOT_FOUND', 404);
    }

    return NextResponse.json(updated);
  } catch (error) {
    logger.error('Error updating task submission', { error });
    return createErrorResponse(error, {
      endpoint: '/api/sync/task-submissions/[id]',
      operation: 'update_task_submission',
    });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const session = await getSession(request.headers, extractRequestContext(request));
    if (!session) {
      return createApplicationErrorResponse('Unauthorized', 'UNAUTHORIZED', 401);
    }

    const { id } = await params;
    if (!isSyncIdentifier(id)) {
      return createValidationErrorResponse(
        'id must be alphanumeric with hyphens/underscores',
        'id',
        id,
      );
    }

    const db = getClient();
    const [task] = await db
      .select({
        submitterId: taskSubmissions.submitterId,
        status: taskSubmissions.status,
        costUsdc: taskSubmissions.costUsdc,
      })
      .from(taskSubmissions)
      .where(eq(taskSubmissions.id, id))
      .limit(1);

    if (!task) {
      return createApplicationErrorResponse('Task not found', 'NOT_FOUND', 404);
    }

    if (session.user.role !== 'admin') {
      if (task.submitterId !== session.user.id) {
        return createApplicationErrorResponse('Forbidden', 'FORBIDDEN', 403);
      }
      if (task.costUsdc !== null) {
        return createApplicationErrorResponse(
          'Billed task submissions cannot be deleted',
          'FORBIDDEN',
          403,
        );
      }
      if (task.status === 'running' || task.status === 'completed') {
        return createApplicationErrorResponse(
          `Cannot delete task in '${task.status}' state`,
          'VALIDATION_ERROR',
          400,
        );
      }
    }

    const [deleted] = await db
      .delete(taskSubmissions)
      .where(eq(taskSubmissions.id, id))
      .returning();

    if (!deleted) {
      return createApplicationErrorResponse('Task not found', 'NOT_FOUND', 404);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Error deleting task submission', { error });
    return createErrorResponse(error, {
      endpoint: '/api/sync/task-submissions/[id]',
      operation: 'delete_task_submission',
    });
  }
}
