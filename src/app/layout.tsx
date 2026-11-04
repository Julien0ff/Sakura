import type { Metadata, Viewport } from "next";
import { Inter, Permanent_Marker, Bebas_Neue } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

const font = Inter({ subsets: ["latin"], variable: "--font-inter" });
const graffitiFont = Permanent_Marker({ weight: "400", subsets: ["latin"], variable: "--font-graffiti" });
const impactFont = Bebas_Neue({ weight: "400", subsets: ["latin"], variable: "--font-impact" });

export const metadata: Metadata = {
  title: "Anime Premium - Streaming Sans Pub",
  description: "Plateforme de streaming d'animes sans publicité avec une expérience premium.",
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
