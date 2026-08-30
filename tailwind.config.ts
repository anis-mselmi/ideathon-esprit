import type { Config } from "tailwindcss";

/**
 * EVA design system.
 * Deep navy primary, soft neutral ground, semantic health colors.
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Brand
        navy: {
          50: "#eef2f9",
          100: "#d5def0",
          200: "#adbede",
          300: "#7f97c8",
          400: "#5471ad",
          500: "#3a5691",
          600: "#2d4373",
          700: "#26375d",
          800: "#1f2c49",
          900: "#141d33",
          950: "#0b1220",
        },
        ground: "#f6f8fb",
        // Semantic
        healthy: "#16a34a",
        warn: "#d97706",
        critical: "#dc2626",
        info: "#2563eb",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      borderRadius: {
        xl: "0.9rem",
        "2xl": "1.25rem",
      },
      boxShadow: {
        card: "0 1px 2px rgba(16,24,40,0.04), 0 1px 3px rgba(16,24,40,0.08)",
        lift: "0 4px 12px rgba(16,24,40,0.08), 0 2px 4px rgba(16,24,40,0.06)",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "pulse-ring": {
          "0%": { boxShadow: "0 0 0 0 rgba(220,38,38,0.4)" },
          "70%": { boxShadow: "0 0 0 8px rgba(220,38,38,0)" },
          "100%": { boxShadow: "0 0 0 0 rgba(220,38,38,0)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.25s ease-out",
        "pulse-ring": "pulse-ring 1.8s infinite",
      },
    },
  },
  plugins: [],
};

export default config;
