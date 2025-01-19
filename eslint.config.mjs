import antfu from '@antfu/eslint-config'

export default antfu({
  formatters: true,
  react: true,
  vue: false,
  typescript: true,
  rules: {
    'no-console': 'warn',
  },
})
