import React from "react";

export const FaUserAlt = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className="size-[20px]"
    viewBox="0 0 20 20"
    fill="currentColor"
  >
    <path
      fillRule="evenodd"
      d="M10 11a3 3 0 100-6 3 3 0 000 6zM7 9a1 1 0 112 0v1h1a1 1 0 110 2H9v1a1 1 0 11-2 0V9z"
      clipRule="evenodd"
    />
  </svg>
);

export const BiSearch = ({ className }: { className: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className={`size-[20px] ${className}`}
    viewBox="0 0 20 20"
    fill="currentColor"
  >
    <path
      fillRule="evenodd"
      d="M8 15a7 7 0 100-14 7 7 0 000 14zM7 7a1 1 0 112 0v1h1a1 1 0 110 2H9v1a1 1 0 11-2 0V9H6a1 1 0 110-2h1V7z"
      clipRule="evenodd"
    />
  </svg>
);

export const HiHome = ({ className }: { className: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className={`size-[20px] ${className}`}
    viewBox="0 0 20 20"
    fill="currentColor"
  >
    <path
      fillRule="evenodd"
      d="M10 11.414l4.95 4.95a1 1 0 101.414-1.414L11.414 10l4.95-4.95a1 1 0 10-1.414-1.414L10 8.586 5.05 3.636a1 1 0 00-1.414 1.414L8.586 10l-4.95 4.95a1 1 0 001.414 1.414L10 11.414z"
      clipRule="evenodd"
    />
  </svg>
);
export const swatch = (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className="size-6"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 6v6m0 0v6m0-6h6m-6 0H6"
    />
  </svg>
);

export const logoShirt = (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className="size-6"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 6v6m0 0v6m0-6h6m-6 0H6"
    />
  </svg>
);

export const stylishShirt = (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className="size-6"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 6v6m0 0v6m0-6h6m-6 0H6"
    />
  </svg>
);

export const EditorTabs = [
  {
    name: "colorpicker",
    icon: swatch,
  },
];

export const FilterTabs = [
  {
    name: "logoShirt",
    icon: logoShirt,
  },
  {
    name: "stylishShirt",
    icon: stylishShirt,
  },
];

export const DecalTypes = {
  logo: {
    stateProperty: "logoDecal",
    filterTab: "logoShirt",
  },
  full: {
    stateProperty: "fullDecal",
    filterTab: "stylishShirt",
  },
};
