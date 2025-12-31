import React, { useEffect, useMemo, useState } from "react";
import { Container, Field, Skeleton } from "reveal/ui/shells";
import { Paragraph } from "reveal/ui/text";
import { VideoComponent } from "reveal/ui/video";
import fetchVideos from "reveal/core/targets/http/fetchVideos";

type Video = {
  url: string;
};

const HomeHeader: React.FC = () => {
  const initialData = useMemo(
    () => [
      {
        url: "https://res.cloudinary.com/dpytkhyme/video/upload/v1699245369/STREETBEEFS%20SCRAPYARD/Drone_intro_r6tlny.mp4",
      },
    ],
    [],
  );
  const [videos, setVideos] = useState<Video[]>(initialData);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchVideos()
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setVideos(data);
          setIsLoading(false);
        } else {
          console.log("Fetched data is empty, retaining initial data.");
        }
      })
      .catch((error) => {
        console.error("Failed to fetch video sources:", error);
        setError("Failed to load video sources.");
        setIsLoading(false);
      });
  }, [initialData]);

  if (error) {
    return <div>Error: {error}</div>;
  }

  return (
    <Container className="relative size-full overflow-hidden">
      {videos.map((video, index) => (
        <VideoComponent key={index} url={video.url} />
      ))}
      {isLoading && (
        <Field>
          <Paragraph>Loading videos...</Paragraph>
          <Skeleton
            className="mx-auto max-w-none overflow-hidden"
            width={600}
            height={600}
          />
        </Field>
      )}
    </Container>
  );
};

export default HomeHeader;
