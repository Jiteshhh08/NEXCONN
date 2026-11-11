import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Vaani Room",
    short_name: "Vaani Room",
    description:
      "Multilingual live Q&A for classrooms and events. Ask in your language. Understand in yours.",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f4ee",
    theme_color: "#0f5c53",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
  };
}
