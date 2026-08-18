import type { Metadata } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { AccountProvider } from "@/features/auth/AccountProvider";
import { LocaleProvider } from "@/features/i18n/LocaleProvider";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { currentWallet } from "@/server/session";
import { getTranslations } from "@/server/locale";
import { currentTheme } from "@/server/theme";
import { db } from "@/server/db";

// Chosen for a conventional Q: the brand name puts one in almost every heading.
const display = Plus_Jakarta_Sans({
  variable: "--font-display",
  subsets: ["latin", "latin-ext"],
  weight: ["600", "700", "800"],
});

const body = Inter({
  variable: "--font-body",
  subsets: ["latin", "latin-ext"],
});

export async function generateMetadata(): Promise<Metadata> {
  const { locale } = await getTranslations();
  return locale === "tr"
    ? {
        title: "CityQuest — Şehir Öğrenme Hesabın",
        description:
          "Şehrini keşfet, yeni bir şey öğren ve kütüphanelerin, müzelerin, bilim merkezlerinin ayrı ayrı doğrulayabileceği bir deneyim hesabı oluştur.",
      }
    : {
        title: "CityQuest — Your City Learning Account",
        description:
          "Explore your city, learn something new, and collect experiences that libraries, museums and science centers can each verify.",
      };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Reading the session and the language here means the header renders signed-in, in the right
  // language, on the first paint — no flash of English and no flash of a signed-out state.
  const [wallet, { locale }, theme] = await Promise.all([
    currentWallet(),
    getTranslations(),
    currentTheme(),
  ]);
  const profile = wallet ? await db().upsertProfile(wallet) : null;

  return (
    <html
      lang={locale}
      // "system" writes no attribute on purpose, leaving prefers-color-scheme in charge. An
      // explicit choice is rendered here rather than applied by script, so a reader who chose
      // dark never gets a white flash first.
      data-theme={theme === "system" ? undefined : theme}
      className={`${display.variable} ${body.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <LocaleProvider locale={locale}>
          <AccountProvider initialProfile={profile}>
            <SiteHeader theme={theme} />
            <main className="flex-1">{children}</main>
            <SiteFooter />
          </AccountProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}
