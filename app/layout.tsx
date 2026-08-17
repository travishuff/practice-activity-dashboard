import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Practice Activity: Travis Huff",
  description: "A live contribution-style view of daily drum practice activity.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
