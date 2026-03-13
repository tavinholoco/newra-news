/** @type {import('eslint').Linter.Config} */
module.exports = {
  extends: ['@newranews/eslint-config/node'],
  parserOptions: {
    project: './tsconfig.json',
    tsconfigRootDir: __dirname,
  },
};
