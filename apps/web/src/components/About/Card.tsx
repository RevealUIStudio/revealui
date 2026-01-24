import type { FC } from "react";
import { useRef } from "react";
import Card from "revealui/ui/cards/Card";

const AboutCard: FC = () => {
	const ref = useRef<HTMLDivElement>(null);
	const cardProps = {
		name: "Sign Up Now",
		image: "src/assets/images/yardatnight.jpg",
		label: "Special Thanks to the OG Branch for making all of this possible!",
		cta: "Check them out!",
		href: "/events",
	};

	return <Card ref={ref} {...cardProps} />;
};

export default AboutCard;
