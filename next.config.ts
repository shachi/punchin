import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // プロキシ環境でのベースパスを設定
  basePath: process.env.BASE_PATH || "",
  // アセットプレフィックスを設定
  assetPrefix: process.env.ASSET_PREFIX || "",
  // 環境変数をクライアントに公開
  publicRuntimeConfig: {
    basePath: process.env.BASE_PATH || "",
  },
};

export default nextConfig;
