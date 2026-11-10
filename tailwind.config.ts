import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#4f46e5", // indigo-600
          fg: "#4338ca", // indigo-700
          soft: "#eef2ff", // indigo-50
        },
      },
      fontFamily: {
        sans: [
          "var(--font-sans)",
          "Pretendard",
          "-apple-system",
          "system-ui",
          "sans-serif",
        ],
      },
      boxShadow: {
        card: "0 1px 2px 0 rgb(0 0 0 / 0.04), 0 1px 3px 0 rgb(0 0 0 / 0.06)",
        "card-hover":
          "0 10px 30px -12px rgb(79 70 229 / 0.25), 0 4px 10px -4px rgb(0 0 0 / 0.08)",
      },
      borderRadius: {
        xl: "0.875rem",
        "2xl": "1.125rem",
      },
      keyframes: {
        "fade-in-up": {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-in-up": "fade-in-up 0.3s ease-out both",
      },
    },
  },
  plugins: [],
};

export default config;
