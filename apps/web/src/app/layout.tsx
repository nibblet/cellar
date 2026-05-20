import type { Metadata, Viewport } from "next";
import { Inter, Playfair_Display } from "next/font/google";
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
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${playfair.variable} dark h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">{children}</body>
    </html>
  );
}
