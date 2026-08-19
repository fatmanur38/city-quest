import { z } from "zod";
import { fail, handle, ok, parseBody } from "@/server/api";
import { requireWallet } from "@/server/session";
import { questBySlug, institutionBySlug } from "@/server/catalog";
import { CREDENTIALS } from "@/lib/credentials";
import { hasCredential } from "@/lib/chain/reads";
import { addressForSlug } from "@/server/institutions";
import { buildClaim, verifyActivityOnChain } from "@/server/chain/writes";
import { db } from "@/server/db";
import { getTranslations } from "@/server/locale";
import { pick } from "@/lib/i18n/types";

/**
 * Claim a quest reward.
 *
 * This route is the clearest argument in the whole project for using a blockchain. Before the
 * municipality is willing to sign "Young Scientist", it checks the prerequisites -- and it does
 * not check them against our database. It reads the library's and the science center's
 * credentials directly from the shared registry.
 *
 * The municipality does not have to trust our app, and our app does not have to be trusted by
 * the museum that reads the resulting credential next year. If a single organisation owned all
 * of this, none of that would be necessary and a database would do.
 */

const schema = z.object({
  questSlug: z.string().min(1),
});

export async function POST(request: Request) {
  return handle(async () => {
    const wallet = await requireWallet();
    const { questSlug } = await parseBody(request, schema);
    const { locale, t } = await getTranslations();

    const quest = questBySlug(questSlug);
    if (!quest) return fail(t.errors.unknownQuest, 404);

    const issuer = institutionBySlug(quest.issuerSlug);
    if (!issuer?.signerRole) return fail(t.errors.nobodyCanIssue, 400);

    const rewardCredential = CREDENTIALS[quest.rewardCredential];
    if (await hasCredential(wallet, rewardCredential.hash)) {
      return fail(t.errors.questAlreadyEarned, 409, "AlreadyEarned");
    }

    const unmet: string[] = [];
    for (const requirement of quest.requirements) {
      if (requirement.kind === "credential") {
        // Verified against the chain, where other institutions put it.
        const held = await hasCredential(wallet, CREDENTIALS[requirement.credential].hash);
        if (!held) unmet.push(pick(requirement.label, locale));
      } else {
        const completion = await db().findCompletion(wallet, requirement.activitySlug, "once");
        if (!completion) unmet.push(pick(requirement.label, locale));
      }
    }

    if (unmet.length > 0) {
      return fail(`Still to do: ${unmet.join(", ")}.`, 409, "RequirementsNotMet");
    }

    const issuerAddress = await addressForSlug(quest.issuerSlug);
    if (!issuerAddress) return fail(t.errors.issuerNotRegistered, 409);

    const claim = buildClaim(wallet, issuerAddress, rewardCredential.hash, 0n);
    const receipt = await verifyActivityOnChain(issuer.signerRole, claim);

    await db().recordCompletion({
      wallet,
      activitySlug: `quest:${quest.slug}`,
      institutionSlug: quest.issuerSlug,
      periodKey: "once",
      xpAwarded: quest.xpReward,
      txHash: receipt.txHash,
    });
    const profile = await db().addXp(wallet, quest.xpReward);

    return ok({
      credential: { title: pick(rewardCredential.title, locale), icon: rewardCredential.icon },
      issuer: pick(issuer.label, locale),
      xpAwarded: quest.xpReward,
      totalXp: profile.xp,
      txHash: receipt.txHash,
    });
  });
}
