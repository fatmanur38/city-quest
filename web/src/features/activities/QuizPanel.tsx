"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { useAccount } from "@/features/auth/AccountProvider";
import { cn } from "@/lib/cn";
import { useTranslations } from "@/features/i18n/LocaleProvider";

/** A quiz question with the answer key stripped out before it reaches the browser. */
export interface PublicQuestion {
  id: string;
  question: string;
  options: string[];
}

interface QuizResult {
  ok: true;
  correct: number;
  total: number;
  passed: boolean;
  alreadyPassed: boolean;
  xpAwarded: number;
  corrections: { id: string; correctIndex: number; chosenIndex: number }[];
}

export function QuizPanel({
  activitySlug,
  questions,
  xpReward,
}: {
  activitySlug: string;
  questions: PublicQuestion[];
  xpReward: number;
}) {
  const router = useRouter();
  const { status, signIn } = useAccount();
  const { t } = useTranslations();
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [result, setResult] = useState<QuizResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allAnswered = questions.every((question) => answers[question.id] !== undefined);

  if (status !== "signed-in") {
    return (
      <Button variant="secondary" onClick={() => signIn()}>
        {t.auth.signInToQuiz}
      </Button>
    );
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/quiz/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          activitySlug,
          answers: questions.map((question) => answers[question.id]),
        }),
      });
      const data = (await response.json()) as QuizResult | { ok: false; error: string };
      if (!data.ok) throw new Error(data.error);
      setResult(data);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The quiz could not be submitted.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      {questions.map((question, index) => {
        const correction = result?.corrections.find((c) => c.id === question.id);
        return (
          <fieldset key={question.id}>
            <legend className="text-sm font-semibold text-ink">
              {index + 1}. {question.question}
            </legend>
            <div className="mt-2.5 grid gap-2">
              {question.options.map((option, optionIndex) => {
                const chosen = answers[question.id] === optionIndex;
                const isCorrect = correction?.correctIndex === optionIndex;
                const isWrongChoice =
                  correction && correction.chosenIndex === optionIndex && !isCorrect;

                return (
                  <label
                    key={option}
                    className={cn(
                      "flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-2.5 text-sm transition-colors",
                      result
                        ? isCorrect
                          ? "border-emerald-500 bg-emerald-100 text-ink"
                          : isWrongChoice
                            ? "border-danger-500 bg-danger-100 text-ink"
                            : "border-border-soft bg-paper-raised text-ink-soft"
                        : chosen
                          ? "border-brand-500 bg-brand-100 text-ink"
                          : "border-border-soft bg-paper-raised hover:bg-paper-sunk",
                    )}
                  >
                    <input
                      type="radio"
                      name={question.id}
                      className="sr-only"
                      disabled={Boolean(result)}
                      checked={chosen}
                      onChange={() =>
                        setAnswers((previous) => ({ ...previous, [question.id]: optionIndex }))
                      }
                    />
                    <span
                      className={cn(
                        "grid size-5 shrink-0 place-items-center rounded-full border-2",
                        chosen ? "border-brand-600 bg-brand-600" : "border-border-soft",
                      )}
                    >
                      {chosen ? <span className="size-1.5 rounded-full bg-white" /> : null}
                    </span>
                    {option}
                  </label>
                );
              })}
            </div>
          </fieldset>
        );
      })}

      {error ? <p className="text-sm font-medium text-danger-700">{error}</p> : null}

      {result ? (
        <div
          className={cn(
            "rounded-2xl p-4",
            result.passed ? "bg-emerald-100" : "bg-sun-100",
          )}
        >
          <p className="font-display text-base font-bold text-ink">
            {t.activities.quizScore(result.correct, result.total)}
          </p>
          <p className="mt-1 text-sm text-ink-soft">
            {result.passed
              ? result.xpAwarded > 0
                ? t.activities.quizPassed(result.xpAwarded)
                : t.activities.quizAlreadyPassed
              : t.activities.quizFailed}
          </p>
          {!result.passed ? (
            <Button
              variant="secondary"
              size="sm"
              className="mt-3"
              onClick={() => {
                setResult(null);
                setAnswers({});
              }}
            >
              {t.activities.tryAgain}
            </Button>
          ) : null}
        </div>
      ) : (
        <Button onClick={submit} disabled={!allAnswered || busy}>
          {busy ? t.activities.checking : t.activities.submitForXp(xpReward)}
        </Button>
      )}
    </div>
  );
}
