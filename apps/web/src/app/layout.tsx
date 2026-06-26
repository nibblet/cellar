import type { Metadata, Viewport } from "next";
import { Fraunces, Inter, Playfair_Display } from "next/font/google";
import { BootSplash } from "@/components/layout/boot-splash";
import { ThemeInitScript } from "@/components/theme";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  display: "swap",
  weight: ["500", "600", "700", "800"],
  style: ["normal", "italic"],
});

// Winston's voice — opinionated upright serif, legible at body size.
// Replaces Playfair italic for prose; Playfair roman stays for display text.
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600"],
  style: ["normal"],
});

export const metadata: Metadata = {
  title: "NCCC",
  description: "Norton Commons Cigar Club — a private tasting archive.",
  applicationName: "NCCC",
  appleWebApp: {
    capable: true,
    title: "NCCC",
    statusBarStyle: "black-translucent",
  },
  manifest: "/manifest.webmanifest",
  icons: {
    // Point both icon slots at the single logo file. Once the source PNG is
    // dropped at /icons/nccc-logo.png, the 404 stops and iOS home-screen
    // shortcuts pick up a real icon. A dedicated apple-touch-icon at the
    // proper 180x180 ships in a future polish pass.
    icon: "/icons/nccc-logo.png",
    apple: "/icons/nccc-logo.png",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F7F1E6" },
    { media: "(prefers-color-scheme: dark)", color: "#15110C" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      // Don't hard-code a theme class here — ThemeInitScript runs first
      // and applies the user's stored choice (or leaves it empty so the
      // OS preference wins). Default appearance stays dark via the
      // @media (prefers-color-scheme: dark) block in globals.css.
      className={`${inter.variable} ${playfair.variable} ${fraunces.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <style
          // biome-ignore lint/security/noDangerouslySetInnerHtml: critical pre-CSS background to prevent white flash
          dangerouslySetInnerHTML={{
            __html: "html,body{background:#15110C}html.light,html.light body{background:#F7F1E6}",
          }}
        />
        <ThemeInitScript />
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground overflow-x-hidden">
        <BootSplash />
        {children}
      </body>
    </html>
  );
}
