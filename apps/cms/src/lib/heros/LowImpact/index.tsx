import type { Page } from "@revealui/core/types/cms";
import type React from "react";
import RichText from "../../components/RichText";

type LowImpactHeroType =
	| {
			children?: React.ReactNode;
			richText?: never;
	  }
	| (Omit<Page["hero"], "richText"> & {
			children?: never;
			richText?: Page["hero"]["richText"];
	  });

export const LowImpactHero: React.FC<LowImpactHeroType> = ({
	children,
	richText,
}) => {
	return (
		<div className="container mt-16">
			<div className="max-w-3xl">
				{children ||
					(richText && <RichText content={richText} enableGutter={false} />)}
			</div>
		</div>
	);
};
