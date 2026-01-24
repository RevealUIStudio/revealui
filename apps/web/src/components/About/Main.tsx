import type { FC } from "react";
import { Image } from "revealui/ui/images";
import {
	Container,
	Field,
	FlexContainer,
	GridContainer,
} from "revealui/ui/shells";
import { Heading, Paragraph, Time } from "revealui/ui/text";

const AboutMain: FC = () => {
	const timeline = [
		{
			name: "Founded company",
			description:
				"Streetbeefs Scrapyard was founded in 2018 by a group of friends who wanted to bring the community together.",
			date: "Aug 2021",
			dateTime: "2021-08",
		},
		{
			name: "Subscriber Goals",
			description:
				"Our goal is to reach a million subscribers by the end of 2023. We are currently at over 275k subscribers.",
			date: "Jun 2023",
			dateTime: "2023-06",
		},
		{
			name: "Fight Schedule",
			description:
				"New fights every week! We are constantly adding new fights to our channel. We have over 1000 fights on our channel.",
			date: "Feb 2022",
			dateTime: "2022-02",
		},
		{
			name: "Internationalization",
			description:
				"Soon we will be adding support for multiple languages. We are currently working on Spanish and French.",
			date: "Jun 2023",
			dateTime: "2023-06",
		},
	];
	return (
		<Container
			className="mx-auto w-full max-w-screen-sm overflow-hidden p-4 lg:max-w-screen-lg "
			index={0}
		>
			<GridContainer
				className="grid-cols-1 md:grid-cols-2 xl:grid-cols-4"
				index={1}
			>
				{timeline.map((item, index) => (
					<Field key={index} className="mx-auto my-10 gap-20">
						<Time className="pb-5" item={item} />
						<Heading
							as={"h1"}
							id="about-timeline-heading"
							className="prose-h1 text-scrapYellow dark:text-scrapOrange text-lg font-semibold "
						>
							{item.name}
						</Heading>
						<Paragraph className="prose-p text-scrapWhite dark:text-scrapGreen px-3 py-0 text-base">
							{item.description}
						</Paragraph>
					</Field>
				))}
			</GridContainer>

			<FlexContainer className="mx-auto mb-20 mt-10 w-full flex-col" index={2}>
				<Heading
					as={"h1"}
					id="about-sponsor-heading"
					className="prose-h1 text-scrapYellow dark:text-scrapOrange pt-20 text-center text-3xl font-bold lg:text-5xl"
				>
					CHECK OUT OUR SPONSORS
				</Heading>
				<Paragraph className="prose-p text-scrapWhite dark:text-scrapGreen text-md max-w-xs text-center lg:max-w-lg lg:text-lg">
					We are proud to be sponsored by these great companies
				</Paragraph>

				<Container className="isolate mx-auto rounded-3xl bg-transparent shadow-2xl ">
					<GridContainer
						className="mx-auto aspect-auto grid-cols-1 lg:grid-cols-3"
						index={1}
					>
						<Image
							className=" aspect-auto rounded-full object-contain lg:p-6"
							src="https://res.cloudinary.com/dpytkhyme/image/upload/v1717457061/STREETBEEFS%20SCRAPYARD/streetbeefs-scrapyard-logo-1_jnrb9t.webp"
							alt="ScrapYard GoPro logo"
							width={200}
							height={200}
						/>
						<Image
							className=" aspect-auto rounded-full object-contain lg:p-6"
							src="https://res.cloudinary.com/dpytkhyme/image/upload/v1717457061/STREETBEEFS%20SCRAPYARD/streetbeefs-scrapyard-logo-1_jnrb9t.webp"
							alt="ScrapYard GoPro logo"
							width={200}
							height={200}
						/>
						<Image
							className=" aspect-auto rounded-full object-contain lg:p-6"
							src="https://res.cloudinary.com/dpytkhyme/image/upload/v1717457061/STREETBEEFS%20SCRAPYARD/streetbeefs-scrapyard-logo-1_jnrb9t.webp"
							alt="ScrapYard GoPro logo"
							width={200}
							height={200}
						/>
					</GridContainer>
				</Container>
			</FlexContainer>

			<GridContainer
				className="mx-auto grid-flow-row grid-cols-1 grid-rows-1 p-3 lg:grid-cols-2"
				index={2}
			>
				<Image
					className="mx-auto rounded object-contain p-4 "
					src="https://res.cloudinary.com/dpytkhyme/image/upload/v1707598201/Beast_Mode_bhfx4x.png"
					alt=""
					width={500}
					height={500}
				/>
				<Field className="from-scrapRed to-scrapRed/60 w-full rounded-2xl bg-gradient-to-bl p-5 lg:p-8">
					<Heading
						as={"h1"}
						id="about-mission-heading"
						className="prose-h1 text-scrapOrange justify-self-auto text-4xl font-bold brightness-150 lg:text-6xl"
					>
						our mission
					</Heading>
					<Paragraph className="prose-p text-scrapWhite mt-1 max-w-xl text-sm brightness-150 ">
						We have support groups to join as well for anyone in need of a
						supportive conversation.
					</Paragraph>

					<Paragraph className="prose-p text-scrapYellow text-md mt-2 font-semibold brightness-150">
						We care about the overall health of all participants and the World
						at large.
					</Paragraph>
				</Field>
			</GridContainer>
			<FlexContainer
				className="mx-auto flex flex-col gap-5 lg:flex-row-reverse"
				index={3}
			>
				<Image
					className="rounded object-contain "
					src="https://res.cloudinary.com/dpytkhyme/image/upload/v1683938638/STREETBEEFS%20SCRAPYARD/scrap_2_elzhah.jpg"
					alt=""
					width={500}
					height={500}
				/>
				<Image
					className="rounded object-contain "
					src="https://res.cloudinary.com/dpytkhyme/image/upload/v1683938637/STREETBEEFS%20SCRAPYARD/148296905_1010847329404852_8980145085586738233_n_hzl9kh.jpg"
					alt=""
					width={500}
					height={500}
				/>
			</FlexContainer>

			<FlexContainer
				className="mx-auto my-10 max-w-screen-sm flex-col lg:max-w-screen-lg"
				index={3}
			>
				<Heading
					as={"h1"}
					id="about-main-heading"
					className="prose-h1 text-scrapYellow my-7 text-center text-3xl font-bold lg:text-4xl"
				>
					Entertain and inspire others through combat sports
				</Heading>
				<Paragraph className=" prose-p text-scrapGreen lg:text-md max-w-sm text-start text-base lg:max-w-3xl lg:text-center">
					We aim to help others tame the fire that burns within, and turn it
					into something constructive to themselves and those around them.
				</Paragraph>
			</FlexContainer>

			<GridContainer className="mx-auto grid-cols-1 gap-5 md:grid-cols-2">
				<Field className=" from-scrapRed to-scrapRed/60 rounded-2xl bg-gradient-to-bl p-8">
					<Heading
						id="about-subscribers-heading"
						as={"h1"}
						className="text-scrapWhite dark:text-scrapBlack prose-h1 max-w-fit flex-none text-4xl font-bold tracking-wide"
					>
						275k+ Subscribers
					</Heading>
					<Field>
						<Paragraph className="prose-p text-scrapWhite dark:text-scrapBlack text-lg font-semibold tracking-wide">
							Premium combat content for our subscribers every week
						</Paragraph>
						<Paragraph className="prose-p text-scrapWhite dark:text-scrapBlack font-semibold leading-5">
							Come check us out on YouTube{" "}
						</Paragraph>
					</Field>
				</Field>

				<Field className=" from-scrapGreen to-scrapGreen/60 rounded-2xl bg-gradient-to-b p-8">
					<Heading
						id="events-heading"
						as={"h1"}
						className="prose-h1 text-scrapWhite dark:text-scrapBlack flex-none text-4xl font-bold tracking-wide"
					>
						20+ Events
					</Heading>
					<Field>
						<Paragraph className="prose-p text-scrapWhite dark:text-scrapBlack text-lg font-semibold tracking-widest">
							We have dozens of fights per event so come check us out
						</Paragraph>
						<Paragraph className="prose-p text-scrapWhite dark:text-scrapBlack font-semibold leading-5">
							Our events are held in the midwest
						</Paragraph>
					</Field>
				</Field>

				<Field className=" from-scrapOrange to-scrapOrange/70 rounded-2xl bg-gradient-to-b p-10">
					<Heading
						id="fighters-heading"
						as={"h1"}
						className="prose-h1 text-scrapWhite dark:text-scrapBlack flex-none text-4xl font-bold tracking-wide"
					>
						100+ Fighters
					</Heading>
					<Field>
						<Paragraph className="proes-p text-scrapWhite dark:text-scrapBlack text-lg font-semibold tracking-widest">
							New fighters every month
						</Paragraph>
						<Paragraph className="prose-p text-scrapWhite dark:text-scrapBlack font-semibold leading-5">
							Our goal is to have 500 fighters participate by 2025
						</Paragraph>
					</Field>
				</Field>
				<Field className=" from-scrapBlue to-scrapBlue/70 rounded-2xl bg-gradient-to-b p-10">
					<Heading
						id="members-heading"
						as={"h1"}
						className="prose-h1 text-scrapWhite dark:text-scrapBlack flex-none text-4xl font-bold tracking-wide"
					>
						Members Only
					</Heading>
					<Field>
						<Paragraph className="text-scrapWhite dark:text-scrapBlack text-lg font-semibold tracking-widest">
							Exclusive content for our members
						</Paragraph>
						<Paragraph className="text-scrapWhite dark:text-scrapBlack font-semibold leading-5">
							Check out our membership options
						</Paragraph>
					</Field>
				</Field>
			</GridContainer>
		</Container>
	);
};

export default AboutMain;
