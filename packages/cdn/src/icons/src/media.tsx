import React from "react";

export const FaPlayCircle = () => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className="size-6"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z"
      />
    </svg>
  );
};

export const FaPauseCircle = () => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className="size-6"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15.75 5.25v13.5m-7.5-13.5v13.5"
      />
    </svg>
  );
};
export const FaPause = ({ className }: { className: string }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className={className}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15.75 5.25v13.5m-7.5-13.5v13.5"
      />
    </svg>
  );
};

export const FaPlay = ({ className }: { className: string }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className={className}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z"
      />
    </svg>
  );
};

export const BsPauseFill = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className="text-white"
    fill="none"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M14 5H10V19H14V5ZM21 5H17V19H21V5Z"
    />
  </svg>
);

export const BsPlayFill = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className="text-white"
    fill="none"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M9 5H7C5.89543 5 5 5.89543 5 7V17C5 18.1046 5.89543 19 7 19H9C10.1046 19 11 18.1046 11 17V7C11 5.89543 10.1046 5 9 5ZM19 5H17C15.8954 5 15 5.89543 15 7V17C15 18.1046 15.8954 19 17 19H19C20.1046 19 21 18.1046 21 17V7C21 5.89543 20.1046 5 19 5Z"
    />
  </svg>
);

export const HiSpeakerWave = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className="text-white"
    fill="none"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M14.1213 8.46447C15.2929 9.63604 15.2929 11.3639 14.1213 12.5355M17.5355 5.05025C19.8787 7.39339 19.8787 11.6066 17.5355 13.9497M20.9497 1.63604C23.2929 3.97918 23.2929 8.19239 20.9497 10.5355M10.6066 14.9497C8.26339 17.2929 3.05025 17.2929 0.707107 14.9497M5.05025 10.5355C2.70711 8.19239 2.70711 3.97918 5.05025 1.63604M8.46447 12.5355C7.29289 11.3639 7.29289 9.63604 8.46447 8.46447"
    />
  </svg>
);

export const HiSpeakerXMark = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className="text-white"
    fill="none"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M13 10H11M17 10H15M9 16H7M15 16H13M12 20C15.3137 20 18 17.3137 18 14V4C18 2.89543 17.1046 2 16 2H8C6.89543 2 6 2.89543 6 4V14C6 17.3137 8.68629 20 12 20Z"
    />

    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 20C8.68629 20 6 17.3137 6 14V4C6 2.89543 6.89543 2 8 2H16C17.1046 2 18 2.89543 18 4V14C18 17.3137 15.3137 20 12 20Z"
    />
  </svg>
);
