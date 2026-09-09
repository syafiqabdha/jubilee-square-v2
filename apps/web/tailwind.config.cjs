/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        jubilee: {
          navy: {
            DEFAULT: '#252F81', // Pantone 2745 C
            dark: '#1A2160',
            light: '#EAEBF5',
          },
          red: {
            DEFAULT: '#C60A4D', // Pantone 207 C
            dark: '#9E083E',
            light: '#FDF2F5',
          },
          magenta: {
            DEFAULT: '#C60A4D', // Pantone 207 C
            dark: '#9E083E',
            light: '#FDF2F5',
          },
          canvas: '#F8FAFC',
          surface: '#FFFFFF',
          'surface-muted': '#F1F5F9',
          border: '#E2E8F0',
          'border-hover': '#CBD5E1',
        },
      },
      fontFamily: {
        sans: ["'The Sans'", "'Plus Jakarta Sans'", "'Inter'", 'Arial', 'system-ui', 'sans-serif'],
        brand: ["'The Sans'", "'Plus Jakarta Sans'", 'Arial', 'sans-serif'],
        mono: ["'JetBrains Mono'", 'monospace'],
      },
      boxShadow: {
        card: '0 4px 6px -1px rgb(0 0 0 / 0.05), 0 2px 4px -2px rgb(0 0 0 / 0.05)',
        'card-hover': '0 10px 15px -3px rgb(0 0 0 / 0.08), 0 4px 6px -4px rgb(0 0 0 / 0.04)',
        dropdown: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.05)',
      },
      borderRadius: {
        sm: '6px',
        md: '10px',
        lg: '16px',
        xl: '24px',
      },
    },
  },
  plugins: [],
};
