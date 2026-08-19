import { z } from "zod";
import { fail, handle, ok, parseBody } from "@/server/api";
import { requireWallet } from "@/server/session";
import { QUIZ_PASS_MARK, QUIZ_QUESTIONS, activityBySlug } from "@/server/catalog";
import { db } from "@/server/db";
import { getTranslations } from "@/server/locale";

/**
 * A quiz the city app scores itself.
 *
 * Deliberately off-chain and deliberately unverified by any institution: nobody watched this
 * person answer, so it would be dishonest to record it as an institutional achievement. It
 * earns points and counts towards a quest, and the account shows it as an app activity rather
 * than a verified one.
 */

const schema = z.object({
  activitySlug: z.string().min(1),
  answers: z.array(z.number().int().min(0)).min(1).max(20),
});

export async function POST(request: Request) {
  return handle(async () => {
    const wallet = await requireWallet();
    const { activitySlug, answers } = await parseBody(request, schema);
    const { t } = await getTranslations();

    const activity = activityBySlug(activitySlug);
    const questions = QUIZ_QUESTIONS[activitySlug];
    if (!activity || activity.kind !== "quiz" || !questions) {
      return fail(t.errors.unknownQuiz, 404);
    }
    if (answers.length !== questions.length) {
      return fail(t.errors.answerEveryQuestion, 400);
    }

    const correct = questions.reduce(
      (total, question, index) => total + (answers[index] === question.correctIndex ? 1 : 0),
      0,
    );
    const score = correct / questions.length;
    const passed = score >= QUIZ_PASS_MARK;

    const alreadyPassed = await db().findCompletion(wallet, activity.slug, "once");
    let xpAwarded = 0;

    if (passed && !alreadyPassed) {
      await db().recordCompletion({
        wallet,
        activitySlug: activity.slug,
        institutionSlug: activity.institutionSlug,
        periodKey: "once",
        xpAwarded: activity.xpReward,
        txHash: null,
      });
      await db().addXp(wallet, activity.xpReward);
      xpAwarded = activity.xpReward;
    }

    return ok({
      correct,
      total: questions.length,
      passed,
      alreadyPassed: Boolean(alreadyPassed),
      xpAwarded,
      // Which ones were wrong, so the quiz can teach rather than just score.
      corrections: questions.map((question, index) => ({
        id: question.id,
        correctIndex: question.correctIndex,
        chosenIndex: answers[index],
      })),
    });
  });
}
