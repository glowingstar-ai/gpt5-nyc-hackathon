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
        "glow-pulse": {
          "0%, 100%": { opacity: "0.6", transform: "scale(1)" },
          "50%": { opacity: "1", transform: "scale(1.08)" }
        },
        "glow-orbit": {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" }
        },
        "glow-float": {
          "0%, 100%": { transform: "translateY(0) rotate(-4deg)" },
          "50%": { transform: "translateY(-4px) rotate(6deg)" }
        }
      },
      animation: {
        "glow-pulse": "glow-pulse 2.8s ease-in-out infinite",
        "glow-orbit": "glow-orbit 6s linear infinite",
        "glow-orbit-fast": "glow-orbit 3s linear infinite",
        "glow-float": "glow-float 4s ease-in-out infinite"
      }
    }
  },
  plugins: [require("@tailwindcss/typography")]
};

export default config;
