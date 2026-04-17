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
};

export default nextConfig;
