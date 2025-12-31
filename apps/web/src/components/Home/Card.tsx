import React, { useEffect, useMemo, useState } from "react";
import Skeleton from "reveal/ui/shells/Skeleton";
import fetchCard from "reveal/core/targets/http/fetchCard";
import { Card } from "reveal/ui/cards";

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
      .then((data) => {
        setCardData(data.length > 0 ? data : initialData);
        setIsLoading(false);
      })
      .catch((error) => {
        setError(error.message);
        setIsLoading(false);
      });
  }, [initialData]);

  if (isLoading) {
    return (
      <Skeleton>
        Loading card...
      </Skeleton>
    );
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  return <Card {...cardData} />;
};

export default HomeCard;
