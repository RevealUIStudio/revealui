"use client";
// TODO: Implement local alternative
// import // @payloadcms/live-preview-react";
import { useRouter } from "next/navigation";
import React from "react";

export const LivePreviewListener: React.FC = () => {
  const router = useRouter();
  return (
    <PayloadLivePreview
      refresh={router.refresh}
      serverURL={process.env.NEXT_PUBLIC_SERVER_URL!}
    />
  );
};
