// @ts-check
import tseslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";

export default [
  {
    ignores: ["dist/**", "node_modules/**", "coverage/**"],
  },
  {
    files: ["src/**/*.ts", "test/**/*.ts"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: "./tsconfig.eslint.json",
        sourceType: "module",
      },
    },
    plugins: {
      "@typescript-eslint": tseslint,
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      "@typescript-eslint/no-unused-vars": "error",
      "@typescript-eslint/explicit-function-return-type": "off",
      "no-restricted-properties": [
        "error",
        {
          object: "Math",
          property: "random",
          message:
            "Interdit dans le moteur : utiliser engine/rng (RNG seedé) pour garder la simulation déterministe.",
        },
      ],
      "no-restricted-globals": [
        "error",
        { name: "Date", message: "Interdit dans le moteur : le temps vient de engine/time, pas de l'horloge système." },
      ],
    },
  },
];
