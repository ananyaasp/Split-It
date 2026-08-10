import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/api/**": ["./src/generated/prisma/*.node"],
    "/dashboard": ["./src/generated/prisma/*.node"],
    "/groups/**": ["./src/generated/prisma/*.node"],
    "/login": ["./src/generated/prisma/*.node"],
    "/register": ["./src/generated/prisma/*.node"],
    "/profile": ["./src/generated/prisma/*.node"],
    "/analytics": ["./src/generated/prisma/*.node"],
    "/join/**": ["./src/generated/prisma/*.node"],
    "/forgot-password": ["./src/generated/prisma/*.node"],
    "/": ["./src/generated/prisma/*.node"],
  },
};

export default nextConfig;
