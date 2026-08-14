import type React from 'react';
import type { LegalSection } from '../content/legal/privacy';

function withMailLink(para: string, email: string | undefined): React.ReactNode {
  if (!email) return para;
  const idx = para.indexOf(email);
  if (idx === -1) return para;
  return (
    <>
      {para.slice(0, idx)}
      <a href={`mailto:${email}`}>{email}</a>
      {para.slice(idx + email.length)}
    </>
  );
}

export function LegalSections({
  sections,
}: {
  readonly sections: readonly LegalSection[];
}): React.JSX.Element {
  return (
    <>
      {sections.map((section) => (
        <div key={section.heading}>
          <h2>{section.heading}</h2>
          {section.subsections?.map((sub) => (
            <div key={sub.heading}>
              <h3>{sub.heading}</h3>
              {sub.paragraph && <p>{sub.paragraph}</p>}
              {sub.listItems && (
                <ul>
                  {sub.listItems.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
          {section.listPreamble && <p>{section.listPreamble}</p>}
          {section.listItems && (
            <ul>
              {section.listItems.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}
          {section.thirdParties && (
            <ul>
              {section.thirdParties.map((tp) => (
                <li key={tp.name}>
                  <strong>{tp.name}</strong>: {tp.description} (
                  <a href={tp.policyUrl}>{tp.policyLabel}</a>){tp.extra ? ` ${tp.extra}` : ''}
                </li>
              ))}
            </ul>
          )}
          {section.paragraphs?.map((para) => (
            <p key={para}>{withMailLink(para, section.contactEmail)}</p>
          ))}
        </div>
      ))}
    </>
  );
}
