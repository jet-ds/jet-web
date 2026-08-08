/** @type {import('prettier').Config} */
export default {
  plugins: ['prettier-plugin-astro'],
  tabWidth: 2,
  useTabs: false,
  semi: true,
  singleQuote: true,
  jsxSingleQuote: false,
  trailingComma: 'all',
  endOfLine: 'lf',
  proseWrap: 'preserve',
  overrides: [{ files: '*.astro', options: { parser: 'astro' } }],
};
