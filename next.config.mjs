/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverComponentsExternalPackages: ["better-sqlite3"]
  },
  // SPA fallback for the embedded Expo Web mobile app at /m/*.
  // public/m/index.html handles all client-side Expo Router navigation.
  // Files under public/m/** (JS chunks, assets) match first; anything else
  // (e.g. /m/round/ABC123 deep-link) rewrites to the SPA shell.
  async rewrites() {
    return {
      fallback: [
        { source: "/m",           destination: "/m/index.html" },
        { source: "/m/:path*",    destination: "/m/index.html" }
      ]
    };
  },
  // CORS: allow the mobile dev server (Expo on :8081) to call our APIs.
  // Same-origin requests from the web app keep working untouched.
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin",  value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET,POST,PATCH,DELETE,OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Content-Type, Authorization" }
        ]
      }
    ];
  }
};
export default nextConfig;
