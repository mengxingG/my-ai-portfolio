import typography from "@tailwindcss/typography";

const config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./utils/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  plugins: [typography],
};

export default config;

