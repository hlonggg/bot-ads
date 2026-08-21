import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        gold: {
          DEFAULT: "#C9A227",
          light: "#E6C866",
          dark: "#9C7A1A",
        },
        ivory: "#FAF9F6",
        charcoal: "#1C1C1E",
      },
      fontFamily: {
        display: ["'Cormorant Garamond'", "serif"],
        body: ["'Inter'", "sans-serif"],
      },
      boxShadow: {
        gold: "0 4px 24px rgba(201, 162, 39, 0.15)",
      },
    },
  },
  plugins: [],
};
export default config;
