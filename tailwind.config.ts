import type { Config } from "tailwindcss";

/**
 * Colours resolve to the CSS custom properties in src/styles/tokens.css rather than to hex
 * literals, so the measured values in that file are the only source of truth. If a token moves,
 * every utility moves with it.
 *
 * Opacity modifiers (`bg-ink/50`) are deliberately unused: they require a colour function
 * instead of a variable, which would put a second, unmeasured colour into the system.
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: "var(--ink)",
          muted: "var(--ink-muted)",
          inverse: "var(--ink-inverse)",
        },
        ground: {
          DEFAULT: "var(--ivory)",
          recipe: "var(--ivory-deep)",
          paper: "var(--paper)",
          dark: "var(--obsidian)",
          "dark-soft": "var(--obsidian-soft)",
        },
        brand: {
          gold: "var(--gold)",
          "gold-deep": "var(--gold-deep)",
          emerald: "var(--emerald)",
          "emerald-deep": "var(--emerald-deep)",
          taupe: "var(--taupe)",
          obsidian: "var(--obsidian)",
          ivory: "var(--ivory)",
        },
        line: "var(--line)",
        danger: "var(--danger)",
        "danger-ground": "var(--danger-ground)",
        success: "var(--success)",
        "success-ground": "var(--success-ground)",
        warning: "var(--warning)",
        "warning-ground": "var(--warning-ground)",
      },
      fontFamily: {
        display: "var(--font-display)",
        body: "var(--font-body)",
      },
      borderRadius: {
        sm: "var(--r-sm)",
        md: "var(--r-md)",
        lg: "var(--r-lg)",
      },
      maxWidth: {
        prose: "68ch",
        shell: "1200px",
      },
    },
  },
  plugins: [],
};

export default config;
