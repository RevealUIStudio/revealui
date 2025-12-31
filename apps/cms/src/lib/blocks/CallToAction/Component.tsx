import { Page } from "@/types";
import React from "react";
import { CMSLink } from "../../components/Link";
import RichText from "../../components/RichText";

type Props = Extract<Page["layout"][0], { blockType: "cta" }>;

export const CallToActionBlock: React.FC<Props> = ({ links, richText }) => {
  return (
    <div className="container">
      <div className="bg-card rounded border-border border p-4 flex flex-col gap-8 md:flex-row md:justify-between md:items-center">
        <div className="max-w-3xl flex items-center">
          {richText && (
            <RichText
              className="mb-0"
              content={richText}
              enableGutter={false}
            />
          )}
        </div>
        <div className="flex flex-col gap-8">
          {(links || []).map(({ link }, i) => {
            return <CMSLink key={i} size="lg" {...link} />;
          })}
        </div>
      </div>
    </div>
  );
};
