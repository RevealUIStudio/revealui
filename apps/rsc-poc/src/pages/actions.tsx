import { submitMessage } from './actions.server.ts';
import { ActionForm } from './action-form.tsx';

export function ActionsPage(): React.ReactNode {
  return (
    <div>
      <h1>Actions — Server Action</h1>
      <p>
        Submitting the form below invokes a <code>&apos;use server&apos;</code> action. The action
        logs <code>[server-action]</code> to the <strong>server</strong> console and returns a
        string that updates the UI — proving a full round-trip.
      </p>
      <ActionForm action={submitMessage} />
    </div>
  );
}
