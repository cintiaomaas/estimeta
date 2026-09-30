import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./finance.css";
import "./reports.css";
export const metadata: Metadata = {
  title: { default: "estimeta · Seu próximo passo começa aqui", template: "%s | estimeta" },
  description: "Seu espaço para uma vida financeira mais organizada. Controle pessoal e familiar, um passo de cada vez.",
  applicationName: "estimeta", manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "estimeta" },
  icons: { icon: "/icon.svg", apple: "/icons/apple-touch-icon.png" },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#174e40" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
