module.exports = {
  root: true,
  ignorePatterns: [".eslintrc.js"],
  extends: ["eslint:recommended", "prettier"],
  parserOptions: {
    ecmaVersion: 2023,
    sourceType: "module",
  },
  rules: {
    "prettier/prettier": "error",
  },
  plugins: ["prettier"],
  overrides: [
    {
      files: ["src/org.savebutton.SaveButton.in"],
      globals: {
        imports: true,
        pkg: true,
      },
    },
    {
      files: ["**/*.ts"],
      extends: [
        "eslint:recommended",
        "plugin:@typescript-eslint/recommended",
        "plugin:@typescript-eslint/recommended-requiring-type-checking",
        "prettier",
      ],
      parser: "@typescript-eslint/parser",
      parserOptions: {
        sourceType: "module",
        project: ["tsconfig.json", "tsconfig.test.json"],
        tsconfigRootDir: __dirname,
        warnOnUnsupportedTypeScriptVersion: false,
      },
      rules: {
        "@typescript-eslint/restrict-template-expressions": [
          "error",
          { allowNullish: true },
        ],
        "prettier/prettier": "error",
      },
      plugins: ["@typescript-eslint", "prettier"],
    },
    {
      files: ["**/*.js"],
      excludedFiles: ["**/*.ts"],
      extends: ["eslint:recommended", "prettier"],
      env: {
        node: true,
      },
      parserOptions: {
        ecmaVersion: 2023,
        sourceType: "module",
      },
      rules: {
        "prettier/prettier": "error",
      },
      plugins: ["prettier"],
    },
  ],
};
