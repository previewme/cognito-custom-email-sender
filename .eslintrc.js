module.exports = {
    root: true,
    parser: '@typescript-eslint/parser',
    parserOptions: {
        ecmaVersion: 2020,
        sourceType: 'module'
    },
    extends: [
        'eslint:recommended',
        'plugin:@typescript-eslint/eslint-recommended',
        'plugin:@typescript-eslint/recommended',
        'plugin:prettier/recommended'
    ],
    env: {
        node: true
    },
    rules: {
        'no-console': ['error', { allow: ['info', 'warn', 'error'] }],
        'prettier/prettier': ['error'],
        'linebreak-style': 'off',
        'func-style': ['error', 'declaration']
    },
    plugins: ['@typescript-eslint', 'prettier']
};
