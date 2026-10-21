import type { NextConfig } from "next";

// The planner PDF is drawn on the original workbook pages; the template PDF
// and fonts are read from disk at runtime, so ship them with these routes.
const PDF_ASSETS = ["./src/lib/pdf/assets/**/*"];

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  outputFileTracingIncludes: {
    "/api/export": PDF_ASSETS,
    "/api/export/preview": PDF_ASSETS,
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
