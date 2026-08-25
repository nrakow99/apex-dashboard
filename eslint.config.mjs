import { defineConfig, globalIgnores } from "eslint/config"
import nextVitals from "eslint-config-next/core-web-vitals"
import nextTypeScript from "eslint-config-next/typescript"

export default defineConfig([
  ...nextVitals,
  ...nextTypeScript,
  {
    files: [
      "app/page.tsx",
      "app/today/page.tsx",
      "components/activate-pa-modal.tsx",
      "components/add-account-modal.tsx",
      "components/edit-account-modal.tsx",
      "components/edit-trade-modal.tsx",
      "components/manual-intraday-drawdown-modal.tsx",
      "components/settings-modal.tsx",
    ],
    rules: {
      // These controlled forms intentionally reset draft state when their
      // record/open prop changes; the dashboard pages hydrate Supabase data.
      "react-hooks/set-state-in-effect": "off",
    },
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
])
