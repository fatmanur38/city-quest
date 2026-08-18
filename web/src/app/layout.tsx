import type { Metadata } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { AccountProvider } from "@/features/auth/AccountProvider";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { currentWallet } from "@/server/session";
import { db } from "@/server/db";

// Chosen for a conventional Q: the brand name puts one in almost every heading.
const display = Plus_Jakarta_Sans({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});

const body = Inter({
  variable: "--font-body",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CityQuest — Your City Learning Passport",
  description:
    "Explore your city, learn something new, and build a passport of experiences that libraries, museums and science centers can each verify.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Reading the session here means the header renders signed-in on first paint, with no flash.
  const wallet = await currentWallet();
  const profile = wallet ? await db().upsertProfile(wallet) : null;

  return (
    <html lang="en" className={`${display.variable} ${body.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <AccountProvider initialProfile={profile}>
          <SiteHeader />
          <main className="flex-1">{children}</main>
          <SiteFooter />
        </AccountProvider>
      </body>
    </html>
  );
}
