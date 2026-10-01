import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "raw.githubusercontent.com",
        pathname: "/Adventech/sabbath-school-lessons/**",
      },
    ],
  },
};

export default nextConfig;
