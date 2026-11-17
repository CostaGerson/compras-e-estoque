/** @type {import('next').NextConfig} */
const nextConfig = { reactStrictMode: true, experimental: { instrumentationHook: true, serverComponentsExternalPackages: ["sharp"] } };
module.exports = nextConfig;
