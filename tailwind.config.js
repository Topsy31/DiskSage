/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        risk: {
          low: '#22c55e',
          'low-medium': '#84cc16',
          medium: '#eab308',
          high: '#f97316',
          critical: '#ef4444'
        },
        confidence: {
          high: '#3b82f6',
          medium: '#f59e0b',
          low: '#9ca3af'
        }
      }
    },
  },
  plugins: [],
}
