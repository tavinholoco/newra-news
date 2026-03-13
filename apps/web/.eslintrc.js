/** @type {import('eslint').Linter.Config} */
module.exports = {
  extends: ['@newranews/eslint-config/next'],
  parserOptions: {
    project: './tsconfig.json',
    tsconfigRootDir: __dirname,
  },
};
