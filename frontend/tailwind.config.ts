import type { Config } from "tailwindcss";
import { fontFamily } from "tailwindcss/defaultTheme";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
    "./node_modules/@radix-ui/themes/dist/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", ...fontFamily.sans],
        heading: ["var(--font-plex)", "var(--font-manrope)", ...fontFamily.sans]
      },
      colors: {
        brand: {
          DEFAULT: "#0F172A",
          foreground: "#F8FAFC"
        }
      },
      keyframes: {
        starTwinkle: {
          "0%, 100%": { transform: "scale(1) rotate(0deg)" },
          "35%": { transform: "scale(1.08) rotate(-4deg)" },
          "65%": { transform: "scale(1.08) rotate(3deg)" }
        },
        starHalo: {
          "0%, 100%": { transform: "scale(0.9)", opacity: "0.3" },
          "50%": { transform: "scale(1.08)", opacity: "0.6" }
        },
        starBurst: {
          "0%": { transform: "scale(0.6)", opacity: "0" },
          "60%": { transform: "scale(1.15)", opacity: "0.35" },
          "100%": { transform: "scale(1.4)", opacity: "0" }
        }
      },
      animation: {
        starTwinkle: "starTwinkle 2.8s ease-in-out infinite",
        starHalo: "starHalo 3.6s ease-in-out infinite",
        starBurst: "starBurst 0.9s ease-out forwards"
      }
    }
  },
  plugins: [require("@tailwindcss/typography")]
};

export default config;
