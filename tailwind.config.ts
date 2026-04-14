import typography from "@tailwindcss/typography";

const config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./utils/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        "bento-bg": "#09090B",
        "bento-card": "#18181B",
        "bento-glow": "#8B5CF6",
        "bento-text": "#FAFAFA",
        "bento-muted": "#A1A1AA",
      },
      borderRadius: {
        bento: "1.5rem",
      },
    },
  },
  plugins: [typography],
};

export default config;

