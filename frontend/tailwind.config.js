/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // 中性灰：去掉默认灰阶里的蓝调，与首页的黑白极简保持一致
        gray: {
          50: '#f9f9fb',
          100: '#f2f3f5',
          200: '#e6e7eb',
          300: '#d2d4da',
          400: '#9a9ea7',
          500: '#6e737c',
          600: '#4b4f57',
          700: '#35383e',
          800: '#1c1e22',
          900: '#0f1012',
          950: '#08090a'
        },
        // 主色调：与首页的强调色同一支蓝（浅色主题取 600，深色主题取 400）
        primary: {
          50: '#eff3ff',
          100: '#dfe6ff',
          200: '#c3cfff',
          300: '#9fb1ff',
          400: '#7c93ff',
          500: '#5a77fe',
          600: '#3b5bfd',
          700: '#2c46db',
          800: '#273bb0',
          900: '#25368a',
          950: '#161e54'
        },
        // 辅助色 - 深蓝灰
        accent: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
          950: '#020617'
        },
        // 深色模式：与首页一致的中性近黑（不带蓝调），950 是页面底色，700 用作描边
        dark: {
          50: '#f7f8f8',
          100: '#e8eaed',
          200: '#cfd3d9',
          300: '#b3b8c0',
          400: '#8a9099',
          500: '#646a73',
          600: '#34373d',
          700: '#24262a',
          800: '#17181b',
          900: '#0f1012',
          950: '#08090a'
        }
      },
      fontFamily: {
        sans: [
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'PingFang SC',
          'Hiragino Sans GB',
          'Microsoft YaHei',
          'sans-serif'
        ],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace']
      },
      boxShadow: {
        // 液态玻璃阴影：数值由 style.css 中的 --glass-* 变量提供，明暗主题自动切换
        glass: 'var(--glass-rim), var(--glass-depth), var(--glass-shadow)',
        'glass-sm': 'var(--glass-rim), var(--glass-shadow-sm)',
        'glass-lg': 'var(--glass-rim), var(--glass-depth), var(--glass-shadow-lg)',
        'glass-field': 'var(--glass-field-shadow)',
        glow: '0 0 20px rgba(90, 119, 254, 0.25)',
        'glow-lg': '0 0 40px rgba(90, 119, 254, 0.35)',
        card: '0 1px 3px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.06)',
        'card-hover': '0 10px 40px rgba(0, 0, 0, 0.08)',
        'inner-glow': 'inset 0 1px 0 rgba(255, 255, 255, 0.1)'
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-primary': 'linear-gradient(135deg, #5a77fe 0%, #3b5bfd 100%)',
        'gradient-dark': 'linear-gradient(135deg, #17181b 0%, #0f1012 100%)',
        'gradient-glass':
          'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%)',
        'mesh-gradient':
          'radial-gradient(at 40% 20%, rgba(90, 119, 254, 0.12) 0px, transparent 50%), radial-gradient(at 80% 0%, rgba(45, 212, 191, 0.08) 0px, transparent 50%), radial-gradient(at 0% 50%, rgba(90, 119, 254, 0.08) 0px, transparent 50%)'
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
        'slide-in-right': 'slideInRight 0.3s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        shimmer: 'shimmer 2s linear infinite',
        glow: 'glow 2s ease-in-out infinite alternate'
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' }
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        },
        slideDown: {
          '0%': { opacity: '0', transform: 'translateY(-10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        },
        slideInRight: {
          '0%': { opacity: '0', transform: 'translateX(20px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' }
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' }
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' }
        },
        glow: {
          '0%': { boxShadow: '0 0 20px rgba(90, 119, 254, 0.25)' },
          '100%': { boxShadow: '0 0 30px rgba(90, 119, 254, 0.4)' }
        }
      },
      backdropBlur: {
        xs: '2px'
      },
      borderRadius: {
        '4xl': '2rem'
      }
    }
  },
  plugins: []
}
