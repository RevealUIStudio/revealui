import { Callout } from '@revealui/presentation';
import { Footer } from '../components/Footer';
import {
  SUBPROCESSORS,
  SUBPROCESSORS_CHANGELOG,
  SUBPROCESSORS_META,
  SUBPROCESSORS_NOTES,
} from '../content/legal/subprocessors';
import { SITE } from '../content/site';

export function SubprocessorsPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl px-6 pt-24 lg:px-8">
        <Callout variant="info" title="Dated subprocessor registry, updated before changes ship">
          We commit to updating this page <em>before</em> adding a new subprocessor, not after.
          Every entry in the table below is accurate as of the date in the header. There is no
          subscribe-to-changes channel yet (queued for after we have customers); for now, watch this
          file in the repository or email{' '}
          <a className="underline" href={`mailto:${SITE.emails.support}`}>
            {SITE.emails.support}
          </a>{' '}
          to be notified by email.
        </Callout>
      </div>

      <section className="mx-auto max-w-4xl px-6 pt-10 lg:px-8">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          {SUBPROCESSORS_META.title}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Last updated: {SUBPROCESSORS_META.lastUpdated}
        </p>
        <p className="mt-6 text-base text-foreground">{SUBPROCESSORS_META.intro}</p>

        <div className="mt-10 overflow-x-auto rounded-xl ring-1 ring-border">
          <table className="w-full divide-y divide-border text-left text-sm">
            <thead className="bg-muted text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-3 font-semibold">
                  Vendor
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  Role
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  Location
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  Data
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  Since
                </th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  Links
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {SUBPROCESSORS.map((sp) => (
                <tr key={sp.name} className="align-top">
                  <td className="px-4 py-4 font-medium text-foreground">{sp.name}</td>
                  <td className="px-4 py-4 text-muted-foreground">{sp.role}</td>
                  <td className="px-4 py-4 text-muted-foreground">{sp.location}</td>
                  <td className="px-4 py-4 text-muted-foreground">
                    <ul className="list-disc pl-4">
                      {sp.dataCategories.map((category) => (
                        <li key={category}>{category}</li>
                      ))}
                    </ul>
                  </td>
                  <td className="px-4 py-4 text-muted-foreground">{sp.since}</td>
                  <td className="px-4 py-4">
                    <ul className="space-y-1">
                      <li>
                        <a
                          className="text-primary underline"
                          href={sp.privacyPolicyUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Privacy policy
                        </a>
                      </li>
                      {sp.dpaUrl && (
                        <li>
                          <a
                            className="text-primary underline"
                            href={sp.dpaUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            DPA
                          </a>
                        </li>
                      )}
                    </ul>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <article className="mx-auto max-w-4xl px-6 pb-24 pt-12 lg:px-8 prose prose-gray">
        <h2>Change log</h2>
        <p>
          Append-only. Every change to the table above lands here in the same commit. Most recent
          first.
        </p>
        <ul>
          {SUBPROCESSORS_CHANGELOG.map((entry) => (
            <li key={entry.date}>
              <strong>{entry.date}</strong> — {entry.summary}
            </li>
          ))}
        </ul>

        <h2>Questions about a specific subprocessor</h2>
        <p>
          {SUBPROCESSORS_NOTES.contactPrefix}
          <a href={`mailto:${SITE.emails.support}`}>{SITE.emails.support}</a>. For privacy-specific
          questions (data rights, DSR requests, GDPR / CCPA), see the{' '}
          <a href="/privacy">Privacy Policy</a>.
        </p>

        <h2>What is not a subprocessor</h2>
        <p>The following are NOT customer-data subprocessors and do not appear in the table:</p>
        <ul>
          <li>
            <strong>GitHub</strong> — we use it for source code hosting only; customer data does not
            flow through GitHub.
          </li>
          <li>
            <strong>npm</strong> — we publish our packages there; customer data does not flow
            through npm.
          </li>
          <li>
            <strong>Local AI inference</strong> (Ollama, Inference Snaps) — runs on the customer's
            own infrastructure, not ours; data does not leave the customer boundary.
          </li>
          <li>
            <strong>Optional integrations</strong> the customer configures themselves (a customer's
            own Sentry account, their own analytics, their own LLM provider) — those are the
            customer's subprocessors, not ours.
          </li>
        </ul>
      </article>
      <Footer />
    </div>
  );
}
