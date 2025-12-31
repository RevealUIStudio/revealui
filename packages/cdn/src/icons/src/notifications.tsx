import React from "react";


export const BellIcon = () => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="size-6 text-gray-500 hover:text-gray-900"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M13 10V3L4 14h7v7l9-11h-7z"
      />
    </svg>
  );
};

export const CheckCircleIcon = ({ className }: { className: string }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={`text-scrapGreen size-6${className}`}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
};
