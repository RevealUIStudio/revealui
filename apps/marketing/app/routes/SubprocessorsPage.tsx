import { LegalPageShell } from '../components/LegalPageShell';
import {
  SUBPROCESSORS,
  SUBPROCESSORS_CHANGELOG,
  SUBPROCESSORS_CHANGELOG_INTRO,
  SUBPROCESSORS_META,
  SUBPROCESSORS_NOT,
  SUBPROCESSORS_NOTES,
  SUBPROCESSORS_QUESTIONS,
} from '../content/legal/subprocessors';
import { SITE } from '../content/site';

export function SubprocessorsPage() {
  return (
    <LegalPageShell
      title={SUBPROCESSORS_META.title}
      lastUpdated={SUBPROCESSORS_META.lastUpdated}
      intro={SUBPROCESSORS_META.intro}
      width="default"
      notice={{
        variant: SUBPROCESSORS_META.notice.variant,
        title: SUBPROCESSORS_META.notice.title,
        body: (
          <>
            {SUBPROCESSORS_META.notice.body}{' '}
            <a href={`mailto:${SITE.emails.support}`}>{SITE.emails.support}</a>.
          </>
        ),
      }}
    >
      <div className="overflow-x-auto rounded-xl ring-1 ring-border">
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
                <td className="px-4 py-4 text-body">{sp.role}</td>
                <td className="px-4 py-4 text-body">{sp.location}</td>
                <td className="px-4 py-4 text-body">
                  <ul className="list-disc pl-4">
                    {sp.dataCategories.map((category) => (
                      <li key={category}>{category}</li>
                    ))}
                  </ul>
                </td>
                <td className="px-4 py-4 text-body">{sp.since}</td>
                <td className="px-4 py-4">
                  <ul className="space-y-1">
                    <li>
                      <a href={sp.privacyPolicyUrl} target="_blank" rel="noopener noreferrer">
                        Privacy policy
                      </a>
                    </li>
                    {sp.dpaUrl && (
                      <li>
                        <a href={sp.dpaUrl} target="_blank" rel="noopener noreferrer">
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

      <h2>{SUBPROCESSORS_CHANGELOG_INTRO.heading}</h2>
      <p>{SUBPROCESSORS_CHANGELOG_INTRO.body}</p>
      <ul>
        {SUBPROCESSORS_CHANGELOG.map((entry) => (
          <li key={entry.date}>
            <strong>{entry.date}</strong>. {entry.summary}
          </li>
        ))}
      </ul>

      <h2>{SUBPROCESSORS_QUESTIONS.heading}</h2>
      <p>
        {SUBPROCESSORS_NOTES.contactPrefix}
        <a href={`mailto:${SITE.emails.support}`}>{SITE.emails.support}</a>.{' '}
        {SUBPROCESSORS_QUESTIONS.privacy} <a href="/privacy">Privacy Policy</a>.
      </p>

      <h2>{SUBPROCESSORS_NOT.heading}</h2>
      <p>{SUBPROCESSORS_NOT.preamble}</p>
      <ul>
        {SUBPROCESSORS_NOT.items.map((item) => (
          <li key={item.name}>
            <strong>{item.name}</strong>: {item.body}
          </li>
        ))}
      </ul>
    </LegalPageShell>
  );
}
