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
      }
    }
  },
  plugins: [require("@tailwindcss/typography")]
};

export default config;
