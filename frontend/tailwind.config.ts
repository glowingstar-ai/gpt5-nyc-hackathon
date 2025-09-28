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
        starPulse: {
          "0%, 100%": {
            transform: "scale(1) rotate(0deg)",
            filter: "drop-shadow(0 0 0 rgba(253, 224, 71, 0.35))"
          },
          "50%": {
            transform: "scale(1.08) rotate(3deg)",
            filter: "drop-shadow(0 0 18px rgba(253, 224, 71, 0.55))"
          }
        },
        sparkle: {
          "0%": {
            transform: "translate3d(0, 0, 0) scale(0.4)",
            opacity: "0"
          },
          "45%": {
            transform: "translate3d(12%, -45%, 0) scale(1)",
            opacity: "1"
          },
          "100%": {
            transform: "translate3d(28%, -80%, 0) scale(0.2)",
            opacity: "0"
          }
        }
      },
      animation: {
        starPulse: "starPulse 3.6s ease-in-out infinite",
        sparkle: "sparkle 2s ease-in-out infinite"
      }
    }
  },
  plugins: [require("@tailwindcss/typography")]
};

export default config;
