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
        // Warm near-black (#151311) surface ramp — brand, not pure #000.
        ink: {
          DEFAULT: "#151311",
          50: "#262119",
          100: "#1D1A16",
          900: "#0F0D0B",
        },
        // Var-driven so Pro/War-Room mode recolours the whole app (gold -> crimson).
        // RGB-channel form keeps Tailwind opacity modifiers (gold/15) working.
        gold: {
          DEFAULT: "rgb(var(--gold) / <alpha-value>)",
          soft: "rgb(var(--gold-soft) / <alpha-value>)",
          deep: "#9C6B3B",
        },
        bronze: "rgb(var(--bronze) / <alpha-value>)",
        // Semantic tier colors for the commission ladder.
        tier: {
          recovery: "#9CA3AF", // < 50%
          strong: "#60A5FA", // 50–79%
          top: "#D7A52C", // 80–99%
          elite: "#34D399", // >= 100%
        },
        risk: "#EF4444",
      },
      fontFamily: {
        heading: ["var(--font-display)", "Georgia", "serif"],
        body: ["var(--font-body)", "system-ui", "sans-serif"],
        ar: ["var(--font-ar)", "system-ui", "sans-serif"],
      },
      borderColor: {
        hairline: "rgb(var(--gold) / 0.18)",
      },
    },
  },
  plugins: [],
};

export default config;
