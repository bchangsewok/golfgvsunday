import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Accent palette — driven by CSS vars so it follows the selected color scheme.
        fairway: {
          50:  "#f0fdf4",
          400: "rgb(var(--accent-400) / <alpha-value>)",
          500: "rgb(var(--accent-500) / <alpha-value>)",
          600: "rgb(var(--accent-600) / <alpha-value>)",
          700: "rgb(var(--accent-700) / <alpha-value>)",
          900: "rgb(var(--accent-900) / <alpha-value>)"
        },
        sand: { 50: "#fefce8", 200: "#fef3c7", 500: "#eab308" },
        rough: { 800: "#1f2937", 900: "#0f172a" }
      },
      fontFamily: { sans: ["ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto"] }
    }
  },
  plugins: []
} satisfies Config;
