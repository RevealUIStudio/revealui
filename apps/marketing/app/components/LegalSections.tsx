import { MarkdownText } from '@revealui/presentation';
import type React from 'react';
import type { LegalSection } from '../content/legal/privacy';

function RichCopy({ text, email }: { text: string; email?: string }): React.JSX.Element {
  if (!email) return <MarkdownText text={text} />;
  const idx = text.indexOf(email);
  if (idx === -1) return <MarkdownText text={text} />;
  return (
    <>
      <MarkdownText text={text.slice(0, idx)} />
      <a href={`mailto:${email}`} className="wrap-anywhere">
        {email}
      </a>
      <MarkdownText text={text.slice(idx + email.length)} />
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
          {section.subsections?.map((sub) => {
            const Container = section.collapsibleSubsections ? 'details' : 'div';
            const Heading = section.collapsibleSubsections ? 'summary' : 'h3';
            return (
              <Container key={sub.heading}>
                <Heading>{sub.heading}</Heading>
                {sub.paragraph && (
                  <p>
                    <RichCopy text={sub.paragraph} />
                  </p>
                )}
                {sub.listItems && (
                  <ul>
                    {sub.listItems.map((item) => (
                      <li key={item}>
                        <RichCopy text={item} />
                      </li>
                    ))}
                  </ul>
                )}
              </Container>
            );
          })}
          {section.listPreamble && (
            <p>
              <RichCopy text={section.listPreamble} />
            </p>
          )}
          {section.listItems && (
            <ul>
              {section.listItems.map((item) => (
                <li key={item}>
                  <RichCopy text={item} />
                </li>
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
            <p key={para}>
              <RichCopy text={para} email={section.contactEmail} />
            </p>
          ))}
        </div>
      ))}
    </>
  );
}
