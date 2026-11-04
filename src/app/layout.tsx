import type { Metadata, Viewport } from "next";
import { Inter, Permanent_Marker, Bebas_Neue } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

const font = Inter({ subsets: ["latin"], variable: "--font-inter" });
const graffitiFont = Permanent_Marker({ weight: "400", subsets: ["latin"], variable: "--font-graffiti" });
const impactFont = Bebas_Neue({ weight: "400", subsets: ["latin"], variable: "--font-impact" });

export const metadata: Metadata = {
  title: { default: "SAKURA", template: "%s · SAKURA" },
  description: "SAKURA — catalogue d'animes, suivi de visionnage et lecteur sans publicité.",
  applicationName: "SAKURA",
  icons: { icon: "/icon.png", apple: "/icon.png" },
  openGraph: {
    title: "SAKURA",
    description: "Catalogue d'animes, suivi de visionnage et lecteur sans publicité.",
    images: [{ url: "/banner.png", width: 1500, height: 500, alt: "SAKURA" }],
    locale: "fr_FR",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: '#000000',
  // Lets the layout extend under the notch / home indicator; safe areas are handled in CSS.
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className="dark h-full antialiased" suppressHydrationWarning>
      <body className={`${font.className} ${font.variable} ${graffitiFont.variable} ${impactFont.variable} min-h-full flex flex-col bg-background text-foreground overflow-hidden`}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
