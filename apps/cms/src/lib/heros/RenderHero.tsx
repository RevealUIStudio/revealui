import type { Page } from "@revealui/core/types/cms";
import type React from "react";
import { HighImpactHero } from "./HighImpact";
import { LowImpactHero } from "./LowImpact";
import { MediumImpactHero } from "./MediumImpact";

const heroes = {
	highImpact: HighImpactHero,
	lowImpact: LowImpactHero,
	mediumImpact: MediumImpactHero,
};

export const RenderHero: React.FC<Page["hero"]> = (props) => {
	const { type } = props || {};

	if (!type || type === "none") return null;

	const HeroToRender = heroes[type];

	if (!HeroToRender) return null;

	return <HeroToRender {...props} />;
};
