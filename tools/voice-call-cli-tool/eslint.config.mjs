import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
    eslint.configs.recommended,
    ...tseslint.configs.recommended,
    ...tseslint.configs.stylistic,
    {
        plugins: {
        },
        rules: {
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/prefer-for-of': 'off',
            'no-trailing-spaces': 'error', // Disallow trailing spaces
            'eol-last': ['error', 'always'], // Enforce newline at end of file
            'indent': ['error', 4], // Enforce 4 spaces for indentation
            'quotes': ['error', 'single'], // Enforce single quotes
            'semi': ['error', 'always'], // Enforce semicolons
        },
    }
);
