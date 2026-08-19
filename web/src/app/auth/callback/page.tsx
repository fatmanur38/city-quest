import { GoogleCallback } from "@/features/auth/GoogleCallback";
import { getTranslations } from "@/server/locale";

export async function generateMetadata() {
  const { t } = await getTranslations();
  return { title: `${t.auth.finishing} — CityQuest` };
}

/**
 * `next` is where the citizen was heading before they were sent to Google. It is checked
 * against a leading slash so a crafted link cannot turn our own sign-in into a redirect to
 * somebody else's site.
 */
export default async function AuthCallbackPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; intent?: string }>;
}) {
  const { next, intent } = await searchParams;
  const safe = next && next.startsWith("/") && !next.startsWith("//") ? next : "/account";
  return <GoogleCallback redirectTo={safe} intent={intent === "link" ? "link" : "signin"} />;
}
