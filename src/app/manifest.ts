import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return { name: "estimeta — Controle pessoal e familiar", short_name: "estimeta", description: "Um passo de cada vez para uma vida financeira organizada.", start_url: "/dashboard", scope: "/", display: "standalone", background_color: "#f6f7f3", theme_color: "#174e40", lang: "pt-BR", icons: [
    { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
    { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
  ] };
}
