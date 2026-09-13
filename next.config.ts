import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // tesseract.js loads its WASM core/worker/traineddata dynamically at
  // runtime; bundling it breaks that, so it must run via native require.
  serverExternalPackages: ["tesseract.js"],
};

export default nextConfig;
