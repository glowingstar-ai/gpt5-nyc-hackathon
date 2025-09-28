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
        "star-twinkle": {
          "0%": {
            transform: "scale(1) rotate(0deg)",
            filter: "drop-shadow(0 0 0 rgba(253, 224, 71, 0.25))"
          },
          "30%": {
            transform: "scale(1.08) rotate(-6deg)",
            filter: "drop-shadow(0 0 12px rgba(253, 224, 71, 0.45))"
          },
          "60%": {
            transform: "scale(0.96) rotate(5deg)",
            filter: "drop-shadow(0 0 6px rgba(253, 224, 71, 0.35))"
          },
          "100%": {
            transform: "scale(1) rotate(0deg)",
            filter: "drop-shadow(0 0 0 rgba(253, 224, 71, 0.25))"
          }
        }
      },
      animation: {
        "star-twinkle": "star-twinkle 4s ease-in-out infinite"
      }
    }
  },
  plugins: [require("@tailwindcss/typography")]
};

export default config;
