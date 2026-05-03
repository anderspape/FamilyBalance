import type { Metadata } from "next";
import "./globals.scss";

export const metadata: Metadata = {
  title: "Budget",
  description: "Lokal-first husstandsøkonomi med bankposter og kategorisering.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="da">
      <body>{children}</body>
    </html>
  );
}
