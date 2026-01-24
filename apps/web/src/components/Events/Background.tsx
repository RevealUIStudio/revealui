import type React from "react";
import { ParallaxComponent } from "revealui/ui/accents";
import {
	BackgroundWrapper,
	GradientConic,
	GradientConicRev,
	GradientToBottom,
	Solid,
} from "revealui/ui/backgrounds";
import { Container } from "revealui/ui/shells";

const EventsBackground = (
	{ children }: { children: React.ReactNode },
	index?: number,
) => {
	return (
		<>
			<ParallaxComponent
				maxWidth={"none"}
				blendMode={"normal"}
				negativeIndex={1}
			>
				<Solid
					key={index}
					color="yellow"
					darkColor="orange"
					negativeIndex={40}
				/>
			</ParallaxComponent>
			<Container className="overflow-hidden" index={0}>
				<BackgroundWrapper
					backgrounds={[
						<GradientConic gradientStops={"from-inherit"} key="conic" />,
						<GradientToBottom key="gradient" className="z-20" />,
						<GradientConicRev key="conicRev" className="z-30" />,
					]}
				>
					{children}
				</BackgroundWrapper>
			</Container>
		</>
	);
};

export default EventsBackground;
