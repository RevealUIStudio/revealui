import React, { FC } from "react";

interface IconProps {
  size: number;
  className?: string;
}

export const Check = ({ className }: { className: string }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className={`${className} size-6`}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 12l4 4L18 8" />
    </svg>
  );
};

export const ChevronUp = ({ className }: { className: string }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className={`${className} size-6`}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19.5 15.75l-7.5-7.5-7.5 7.5"
      />
    </svg>
  );
};

export const ChevronDown = ({ className }: { className: string }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className={`${className} size-6`}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4.5 8.25l7.5 7.5 7.5-7.5"
      />
    </svg>
  );
};

export const ChevronLeft = ({ className }: { className: string }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className={`${className} size-6`}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15.75 19.5 8.25 12l7.5-7.5"
      />
    </svg>
  );
};

export const ChevronRight = ({ className }: { className: string }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className={`${className} size-6`}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m8.25 4.5 7.5 7.5-7.5 7.5"
      />
    </svg>
  );
};
export const BsArrowLeftShort = ({ className }: { className: string }) => {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M11.854 3.854a.5.5 0 010 .707L8.707 8l3.147 3.146a.5.5 0 11-.708.708l-3.5-3.5a.5.5 0 010-.708l3.5-3.5a.5.5 0 01.708 0z"
        clipRule="evenodd"
      />
      <path
        fillRule="evenodd"
        d="M4.5 3a.5.5 0 01.5.5v8a.5.5 0 01-1 0v-8a.5.5 0 01.5-.5z"
        clipRule="evenodd"
      />
    </svg>
  );
};

export const BsArrowRightShort = ({ className }: { className: string }) => {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M4.146 3.146a.5.5 0 010 .708L7.293 8l-3.147 3.146a.5.5 0 11-.708-.708l3.5-3.5a.5.5 0 010-.707l-3.5-3.5a.5.5 0 01.708 0z"
        clipRule="evenodd"
      />
      <path
        fillRule="evenodd"
        d="M11.5 3a.5.5 0 00-.5.5v8a.5.5 0 001 0v-8a.5.5 0 00-.5-.5z"
        clipRule="evenodd"
      />
    </svg>
  );
};
export const RxCaretRight = ({ className }: { className: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className={`size-[20px] ${className}`}
    viewBox="0 0 20 20"
    fill="currentColor"
  >
    <path
      fillRule="evenodd"
      // eslint-disable-next-line max-len
      d="M10 11a3 3 0 100-6 3 3 0 000 6zM7 9a1 1 0 112 0v1h1a1 1 0 110 2H9v1a1 1 0 11-2 0V9z"
      clipRule="evenodd"
    />
  </svg>
);

export const RxCaretLeft = ({ className }: { className: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className={`size-[20px] ${className}`}
    viewBox="0 0 20 20"
    fill="currentColor"
  >
    <path
      fillRule="evenodd"
      // eslint-disable-next-line max-len
      d="M10 11a3 3 0 100-6 3 3 0 000 6zM7 9a1 1 0 112 0v1h1a1 1 0 110 2H9v1a1 1 0 11-2 0V9z"
      clipRule="evenodd"
    />
  </svg>
);
export const Bars3Icon: FC<IconProps> = ({ className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={1.5}
    stroke="currentColor"
    className={`size-6 ${className}`}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
    />
  </svg>
);

export const XMarkIcon: FC<IconProps> = ({ className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={1.5}
    stroke="currentColor"
    className={`size-6 ${className}`}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M6 18L18 6M6 6l12 12"
    />
  </svg>
);

export const ArrowBigLeft = ({ className }: { className: string }) => (
  <svg
    className={className}
    width="100%"
    height="100%"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="19 12 5 12 12 5"></polyline>
  </svg>
);

export const ArrowBigRight = ({ className }: { className: string }) => (
  <svg
    className={className}
    width="100%"
    height="100%"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="5 12 19 12 12 5"></polyline>
  </svg>
);

export const Circle = ({ className }: { className: string }) => (
  <svg
    className={className}
    width="100%"
    height="100%"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="10"></circle>
  </svg>
);

export const CircleDot = ({ className }: { className: string }) => (
  <svg
    className={className}
    width="100%"
    height="100%"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="3"></circle>
  </svg>
);

export const DotFilled = ({ className }: { className: string }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 100"
      className={`size-6 ${className}`}
    >
      <circle cx={50} cy={50} r={10} fill="scrapBlack" />
    </svg>
  );
};

export const AiFillStepBackward = () => (
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
      d="M11 19V5M5 12L11 5L11 19Z"
    />
  </svg>
);

export const AiFillStepForward = () => (
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
      d="M13 5V19M19 12L13 19L13 5Z"
    />
  </svg>
);
