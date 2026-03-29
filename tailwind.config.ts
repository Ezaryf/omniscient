import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)"],
        mono: ["var(--font-mono)"],
      },
      borderRadius: {
        sm: "8px",
        md: "10px",
        lg: "12px",
        xl: "14px",
      },
      colors: {
        canvas: "var(--bg-canvas)",
        panel: "var(--bg-panel)",
        dock: "var(--bg-dock)",
        elevated: "var(--bg-elevated)",
        foreground: "var(--text-primary)",
        muted: "var(--text-secondary)",
        subtle: "var(--text-muted)",
        line: "var(--border-subtle)",
        lineStrong: "var(--border-strong)",
        accent: "var(--accent-primary)",
      },
      boxShadow: {
        panel: "0 18px 42px rgba(0, 0, 0, 0.34)",
        dock: "0 24px 56px rgba(0, 0, 0, 0.42)",
      },
    },
  },
};

export default config;
