import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Saarathi Cabs",
    short_name: "Saarathi",
    description: "Book your personal driver for outstation, airport and local rides.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#fb5b21",
    orientation: "portrait",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon-maskable.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Book a ride", url: "/book" },
      { name: "My rides", url: "/account/bookings" },
      { name: "Driver console", url: "/admin" },
    ],
  };
}
