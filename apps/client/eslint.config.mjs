import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals"),
  {
    rules: {
      // All images use dynamic API URLs (resolveFileUrl, blob:, /api/storage/)
      // that are incompatible with next/image's static optimization requirements
      "@next/next/no-img-element": "off",
      // Spanish text naturally uses quotes in JSX — not a real issue
      "react/no-unescaped-entities": "off",
      // All cases are intentional fetch-on-mount / subscribe-once patterns
      "react-hooks/exhaustive-deps": "off",
      "@next/next/no-html-link-for-pages": "warn",
    },
  },
];

export default eslintConfig;
