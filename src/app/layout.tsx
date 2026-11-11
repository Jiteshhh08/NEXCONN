import type { Metadata, Viewport } from "next";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

import "./globals.css";

const baseUrl = process.env.APP_BASE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: {
    default: "Vaani Room — Ask in your language",
    template: "%s · Vaani Room",
  },
  description:
    "A multilingual live Q&A space for classrooms and events. Students ask in their language; hosts moderate and answer once.",
  applicationName: "Vaani Room",
  openGraph: {
    title: "Vaani Room — Ask in your language",
    description:
      "A multilingual live Q&A space for classrooms and events. Ask in your language. Understand in yours.",
    type: "website",
    siteName: "Vaani Room",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0f5c53",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col">
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <SiteHeader />
        <main id="main" className="flex-1">
          {children}
        </main>
        <SiteFooter />
      </body>
    </html>
  );
}
