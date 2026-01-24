import type React from "react";

import { Code } from "./Component.client";

export type CodeBlockProps = {
	code: string;
	language?: string;
	blockType: "code";
	className?: string;
};

export const CodeBlock: React.FC<CodeBlockProps> = ({
	className,
	code,
	language,
}) => {
	return (
		<div className={[className, "not-prose"].filter(Boolean).join(" ")}>
			<Code code={code} language={language} />
		</div>
	);
};
