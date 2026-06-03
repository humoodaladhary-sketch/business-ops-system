import type { Config } from "tailwindcss";

/**
 * Brand system (from the brief):
 *   background #1E1E1E, gold accent #C9A052, white text
 *   headings: Cormorant Garamond · body: Inter
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: "#1E1E1E",
          50: "#2A2A2A",
          100: "#242424",
          900: "#171717",
        },
        gold: {
          DEFAULT: "#C9A052",
          soft: "#E0C488",
          deep: "#A07F35",
        },
        // Semantic tier colors for the commission ladder.
        tier: {
          recovery: "#9CA3AF", // < 50%
          strong: "#60A5FA", // 50–79%
          top: "#C9A052", // 80–99%
          elite: "#34D399", // >= 100%
        },
        risk: "#EF4444",
      },
      fontFamily: {
        heading: ["var(--font-cormorant)", "Georgia", "serif"],
        body: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
      borderColor: {
        hairline: "rgba(201,160,82,0.18)",
      },
    },
  },
  plugins: [],
};

export default config;
