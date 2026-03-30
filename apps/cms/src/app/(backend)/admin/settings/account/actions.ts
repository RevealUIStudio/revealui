'use server';

import { changePassword, getSession } from '@revealui/auth/server';
import { headers } from 'next/headers';
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Schema (server-side Zod v4)
// ---------------------------------------------------------------------------

const ChangePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z.string().min(8, 'New password must be at least 8 characters'),
    confirmPassword: z.string().min(1, 'Please confirm your new password'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

// ---------------------------------------------------------------------------
// Result shape (Conform-compatible)
// ---------------------------------------------------------------------------

export interface ChangePasswordState {
  status: 'idle' | 'success' | 'error';
  fieldErrors?: {
    currentPassword?: string[];
    newPassword?: string[];
    confirmPassword?: string[];
  };
  formError?: string;
}

// ---------------------------------------------------------------------------
// Action
// ---------------------------------------------------------------------------

export async function changePasswordAction(
  _prevState: ChangePasswordState | undefined,
  formData: FormData,
): Promise<ChangePasswordState> {
  const raw = {
    currentPassword: formData.get('currentPassword'),
    newPassword: formData.get('newPassword'),
    confirmPassword: formData.get('confirmPassword'),
  };

  const parsed = ChangePasswordSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: ChangePasswordState['fieldErrors'] = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0] as keyof typeof fieldErrors;
      if (field) {
        fieldErrors[field] = [...(fieldErrors[field] ?? []), issue.message];
      }
    }
    return { status: 'error', fieldErrors };
  }

  const session = await getSession(await headers());
  if (!session) {
    return { status: 'error', formError: 'Not authenticated. Please sign in again.' };
  }

  const { currentPassword, newPassword } = parsed.data;
  // Pass current session ID so changePassword can invalidate all other sessions
  const result = await changePassword(
    session.user.id,
    currentPassword,
    newPassword,
    session.session.id,
  );

  if (!result.success) {
    return {
      status: 'error',
      formError:
        result.error ?? 'Unable to change password. Contact support@revealui.com if this persists.',
    };
  }

  return { status: 'success' };
}
