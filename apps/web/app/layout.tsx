import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AgentWallet",
  description: "Wallets for AI agents with owner-controlled spending policies"
};

export default function RootLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
