/** @type {import('tailwindcss').Config} */

import aspectRatio from "@tailwindcss/aspect-ratio";
import forms from "@tailwindcss/forms";
import typography from "@tailwindcss/typography";
import defaultTheme from "tailwindcss/defaultTheme";
import sharedConfig from "config/tailwind";

const fontFamily = defaultTheme?.fontFamily || {};

export default {
  ...sharedConfig,
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  
  ],
  darkMode: "media", // or 'class'
  theme: {
    screens: {
      ...defaultTheme.screens,
    },
    container: {
      center: true,
    },
    aspectRatio: {
      ...defaultTheme.aspectRatio,
    },
    fontFamily: {
      sans: ["Inter", ...(fontFamily.sans || [])],
      serif: ["Inter", ...(fontFamily.serif || [])],
    },
    extend: {
      screens: {
        xs: "475px",
        "8xl": "1920px",
        "9xl": "2560px",
        "10xl": "3840px",
      },
      colors: {
        scrapBlack: "#020617",
        scrapWhite: "#f8fafc",
        scrapRed: "#b91c1c",
        scrapYellow: "#fde047",
        scrapOrange: "#ea580c",
        scrapGreen: "#15803d",
        scrapBlue: "#1e3a8a",
      },
      fontFamily: {
        sans: ["Inter", "sans-serif"],
        serif: ["Inter", "serif"],
      },
      maxWidth: {
        "8xl": "1920px",
        "9xl": "2560px",
        "10xl": "3840px",
      },
      aspectRatio: {
        "3/2": "3 / 2",
        "4/3": "4 / 3",
        "21/9": "21 / 9",
        "16/9": "16 / 9",
        "1/1": "1 / 1",
      },
      fontSize: {
        xs: ["0.75rem", { lineHeight: "1rem" }],
        sm: ["0.875rem", { lineHeight: "1.5rem" }],
        base: ["1rem", { lineHeight: "1.75rem" }],
        lg: ["1.125rem", { lineHeight: "1.75rem" }],
        xl: ["1.25rem", { lineHeight: "2rem" }],
        "2xl": ["1.5rem", { lineHeight: "2.25rem" }],
        "3xl": ["1.75rem", { lineHeight: "2.25rem" }],
        "4xl": ["2rem", { lineHeight: "2.5rem" }],
        "5xl": ["2.5rem", { lineHeight: "3rem" }],
        "6xl": ["3rem", { lineHeight: "3.5rem" }],
        "7xl": ["4rem", { lineHeight: "4.5rem" }],
        "8xl": ["5rem", { lineHeight: "1" }],
        "9xl": ["6rem", { lineHeight: "1" }],
        "10xl": ["8rem", { lineHeight: "1" }],
      },
    },
  },
  plugins: [typography, forms, aspectRatio],
  safelist: generateSafelist(),
};

function generateSafelist() {
  const colors = ["scrapOrange", "scrapBlack", "scrapYellow", "scrapWhite"];
  const prefixes = ["from", "to", "ring", "shadow"];

  const safelist = [];
  colors.forEach((color) => {
    prefixes.forEach((prefix) => {
      safelist.push(`${prefix}-${color}`);
      if (prefix === "shadow") {
        safelist.push(`${prefix}-${color}/20`);
      }
    });
  });

  return safelist;
}
