/** @type {import('tailwindcss').Config} */
export default {
	content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
	theme: {
		extend: {
			colors: {
				bg: {
					DEFAULT: '#0a0a0f',
					alt: '#12121a',
				},
				accent: {
					DEFAULT: '#22d3ee',
					hover: '#06b6d4',
					glow: 'rgba(34, 211, 238, 0.5)',
				},
				text: {
					DEFAULT: '#e8e6e3',
					muted: '#9ca3af',
				},
				border: '#27272a',
			},
			fontFamily: {
				sans: ['Inter', 'sans-serif'],
				mono: ['JetBrains Mono', 'monospace'],
			},
			animation: {
				'fade-in': 'fadeIn 0.5s ease-out forwards',
				'float': 'float 6s ease-in-out infinite',
				'tilt': 'tilt 10s infinite linear',
			},
			keyframes: {
				fadeIn: {
					'0%': { opacity: '0', transform: 'translateY(10px)' },
					'100%': { opacity: '1', transform: 'translateY(0)' },
				},
				float: {
					'0%, 100%': { transform: 'translateY(0)' },
					'50%': { transform: 'translateY(-20px)' },
				},
				tilt: {
					'0%, 50%, 100%': {
						transform: 'rotate(0deg)',
					},
					'25%': {
						transform: 'rotate(1deg)',
					},
					'75%': {
						transform: 'rotate(-1deg)',
					},
				},
			},
		},
	},
	plugins: [],
}
