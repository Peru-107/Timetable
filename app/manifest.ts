import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Timetable Tracker",
    short_name: "Timetable",
    description: "Track your timetable, attendance, and CGPA in one place",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#f6f4ef",
    theme_color: "#b5762c",
    orientation: "portrait-primary",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
