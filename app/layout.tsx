import type { Metadata } from "next";
import { IBM_Plex_Serif, Mona_Sans} from "next/font/google";

import Navbar from "@/components/Navbar";
import "./globals.css";
import {Toaster} from "@/components/ui/sonner";
import {checkMetricsAccess} from "@/lib/metrics/access";
import {checkAdminAccess} from "@/lib/admin/access";

const ibmPlexSerif = IBM_Plex_Serif({
    variable: "--font-ibm-plex-serif",
    subsets: ['latin'],
    weight: ['400', '500', '600', '700'],
    display: 'swap'
});

const monaSans = Mona_Sans({
    variable: '--font-mona-sans',
    subsets: ['latin'],
    display: 'swap'
})

export const metadata: Metadata = {
  title: "Investfied",
  description: "Transforma tus investigaciones en conversaciones interactivas con IA. Sube PDFs y chatea con tus investigaciones usando tu voz.",
  icons: {
    icon: "/assets/logo.png",
    shortcut: "/assets/logo.png",
    apple: "/assets/logo.png",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [metricsAccess, adminAccess] = await Promise.all([
    checkMetricsAccess(),
    checkAdminAccess(),
  ]);

  return (
    <html lang="es">
      <body
        className={`${ibmPlexSerif.variable} ${monaSans.variable} relative font-sans antialiased`}
      >
        <Navbar showMetrics={metricsAccess.allowed} showAdmin={adminAccess.allowed} />
        {children}
        <Toaster />
      </body>
    </html>
  );
}
