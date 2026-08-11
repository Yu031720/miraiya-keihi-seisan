import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "みらいや経費精算",
    short_name: "経費精算",
    description: "週次経費報告を簡単にまとめるための社内ツール",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#fff7ed",
    theme_color: "#f97316",
    icons: [
      { src: "/icon", sizes: "192x192", type: "image/png" },
      { src: "/icon-512", sizes: "512x512", type: "image/png" },
    ],
  };
}
