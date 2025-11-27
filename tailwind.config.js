/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic':
          'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
      },
      animation: {
        'planet-pulse': 'planetPulse 3s ease-in-out infinite alternate',
        'bridge-flow': 'bridgeFlow 2s linear infinite',
        'floating': 'floating 6s ease-in-out infinite',
        'progress-bar': 'progressFlow 3s ease-in-out infinite',
        'transfer-pulse': 'transferPulse 2s ease-in-out infinite',
        'particle': 'particle 4s linear infinite',
        'slide-up': 'slideUp 0.3s ease-out',
        'fade-in': 'fadeIn 0.5s ease-out',
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite alternate',
        'slide-in': 'slideIn 0.5s ease-out forwards',
      },
      keyframes: {
        planetPulse: {
          '0%': { boxShadow: '0 0 30px rgba(255, 201, 77, 0.4)' },
          '100%': { boxShadow: '0 0 50px rgba(255, 201, 77, 0.8)' },
        },
        bridgeFlow: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
        floating: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        progressFlow: {
          '0%': { width: '0%' },
          '50%': { width: '70%' },
          '100%': { width: '100%' },
        },
        transferPulse: {
          '0%, 100%': { transform: 'scale(1)', opacity: '1' },
          '50%': { transform: 'scale(1.1)', opacity: '0.8' },
        },
        particle: {
          '0%': { transform: 'translateX(-50px) scale(0)', opacity: '0' },
          '10%': { opacity: '1' },
          '90%': { opacity: '1' },
          '100%': { transform: 'translateX(350px) scale(1)', opacity: '0' },
        },
        slideUp: {
          from: { transform: 'translateY(100%)', opacity: '0' },
          to: { transform: 'translateY(0)', opacity: '1' },
        },
        fadeIn: {
          from: { opacity: '0', transform: 'translateY(20px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        pulseGlow: {
          '0%': { boxShadow: '0 0 5px rgba(255, 201, 77, 0.3)' },
          '100%': { boxShadow: '0 0 15px rgba(255, 201, 77, 0.6)' },
        },
        slideIn: {
          from: { transform: 'translateX(100%)', opacity: '0' },
          to: { transform: 'translateX(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}