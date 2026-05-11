/** @type {import('next').NextConfig} */
const nextConfig = {
  // Transpile Mantine packages for App Router compatibility
  transpilePackages: [
    "@mantine/core",
    "@mantine/hooks",
    "@mantine/dates",
    "@mantine/form",
    "@mantine/notifications",
  ],

  // Exclude native Node.js modules from webpack bundling.
  // better-sqlite3 uses a native C++ addon and cannot be bundled by webpack.
  // Note: Next.js 14 uses experimental.serverComponentsExternalPackages,
  //       Next.js 15+ renamed it to serverExternalPackages.
  experimental: {
    serverComponentsExternalPackages: ["better-sqlite3"],
  },
};

export default nextConfig;
