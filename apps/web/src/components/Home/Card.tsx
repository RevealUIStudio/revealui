import type React from "react";
import { useEffect, useMemo, useState } from "react";
import {
	type CardData as FetchCardData,
	fetchCard,
} from "revealui/client/http";
import { Card } from "revealui/ui/cards";
import Skeleton from "revealui/ui/shells/Skeleton";

type CardData = {
	name: string;
	image: string;
	label: string;
	cta: string;
	href: string;
	loading?: "eager" | "lazy";
};

const HomeCard: React.FC = () => {
	const initialData: CardData = useMemo(
		() => ({
			name: "Scrapyard Records",
			image:
				"https://res.cloudinary.com/dpytkhyme/image/upload/v1686377854/STREETBEEFS%20SCRAPYARD/received_379940754080520_hzf7q1.jpg",
			label: "ScrapRecords Label",
			cta: "Check out all Media",
			href: "/",
			loading: "eager",
		}),
		[],
	);
	const [cardData, setCardData] = useState<CardData>(initialData);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		setIsLoading(true);
		fetchCard()
			.then((data: FetchCardData[]) => {
				setCardData(data.length > 0 ? data[0] : initialData);
				setIsLoading(false);
			})
			.catch((error: unknown) => {
				const message =
					error instanceof Error ? error.message : "Failed to fetch card data";
				setError(message);
				setIsLoading(false);
			});
	}, [initialData]);

	if (isLoading) {
		return <Skeleton>Loading card...</Skeleton>;
	}

	if (error) {
		return <div>Error: {error}</div>;
	}

	return <Card {...cardData} />;
};

export default HomeCard;
