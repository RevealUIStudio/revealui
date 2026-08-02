import { getSession } from '../auth/session-server.ts';
import { SecretPingForm, WhoamiButton } from './session-client.tsx';

export async function SessionPage(): Promise<React.ReactNode> {
  const session = await getSession();

  return (
    <div>
      <h1>Session — dogfood auth (2.3.1)</h1>
      <p>
        Minimal <strong>signed HttpOnly cookie</strong> (owner ruling). Not admin session. Sign-in
        uses progressive form POST to <code>/api/session/login</code>.
      </p>
      <p data-session-status="">
        Server view: {session ? `signed-in as ${session.sub}` : 'anonymous'}
      </p>

      <section style={{ marginTop: 24 }}>
        <h2>Sign in / out</h2>
        <form
          method="POST"
          action="/api/session/login"
          style={{ display: 'flex', gap: 8, marginBottom: 12 }}
        >
          <input type="hidden" name="sub" value="demo" />
          <button type="submit">Sign in as demo</button>
        </form>
        <form method="POST" action="/api/session/logout">
          <button type="submit">Sign out</button>
        </form>
      </section>

      <section style={{ marginTop: 24 }}>
        <h2>Public action</h2>
        <WhoamiButton />
      </section>

      <section style={{ marginTop: 24 }}>
        <h2>Protected action (useAction → 403 if anonymous)</h2>
        <SecretPingForm />
      </section>
    </div>
  );
}
