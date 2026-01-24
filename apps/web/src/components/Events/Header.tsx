import type React from "react";
import { Image } from "revealui/ui/images";
import { Container, GridContainer } from "revealui/ui/shells";
import { WelcomeHeading } from "revealui/ui/text";

const EventsHeader = (): React.ReactElement => {
	return (
		<GridContainer className="relative size-full h-screen" index={0}>
			<Container
				className="bg-scrapBlack/70 text-scrapOrange absolute z-50 mx-auto size-full place-content-center "
				index={0}
			>
				<WelcomeHeading />
			</Container>
			<Image
				src="https://res.cloudinary.com/dpytkhyme/image/upload/v1685928573/STREETBEEFS%20SCRAPYARD/scrapyard_event_june_wswkdz.jpg"
				alt=""
				className="shimmer bg-scrapBlack border-scrapBlack -z-50 aspect-[9/4] size-full h-screen rounded-sm border object-cover opacity-5 xl:rounded-3xl"
			/>
		</GridContainer>
	);
};

export default EventsHeader;
