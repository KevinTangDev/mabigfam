import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api, photoUrl } from "../api/client";
import { Button, cardClass } from "../components/ui";
import type { FamilyMember } from "../types";

/** Minimum photographed members needed for a question to have wrong answers. */
const MIN_PLAYABLE = 3;
const CHOICES = 4;

interface Question {
  answer: FamilyMember;
  options: FamilyMember[];
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

/**
 * Builds a question. Decoys are drawn from everyone (not just photographed
 * members), so a small family with few photos still gets plausible choices.
 */
function makeQuestion(
  photographed: FamilyMember[],
  everyone: FamilyMember[],
  avoidId?: string,
): Question {
  const pool = photographed.length > 1 ? photographed.filter((m) => m.id !== avoidId) : photographed;
  const answer = pool[Math.floor(Math.random() * pool.length)]!;

  const decoys = shuffle(everyone.filter((m) => m.id !== answer.id)).slice(0, CHOICES - 1);

  return { answer, options: shuffle([answer, ...decoys]) };
}

export default function GameView() {
  const [members, setMembers] = useState<FamilyMember[] | null>(null);
  const [question, setQuestion] = useState<Question | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [score, setScore] = useState({ right: 0, asked: 0 });
  const [streak, setStreak] = useState(0);
  const [best, setBest] = useState(0);

  useEffect(() => {
    api.listMembers().then(setMembers).catch(() => setMembers([]));
  }, []);

  const photographed = useMemo(
    () => (members ?? []).filter((m) => m.photoPath),
    [members],
  );

  const nextQuestion = useCallback(
    (avoidId?: string) => {
      if (!members || photographed.length < MIN_PLAYABLE) return;
      setPicked(null);
      setQuestion(makeQuestion(photographed, members, avoidId));
    },
    [members, photographed],
  );

  useEffect(() => {
    if (!question) nextQuestion();
  }, [question, nextQuestion]);

  if (!members) return <p className="text-sm text-ctp-subtext0">Loading...</p>;

  if (photographed.length < MIN_PLAYABLE) {
    return (
      <div className={`${cardClass} p-8 text-center`}>
        <p className="text-3xl" aria-hidden="true">
          📸
        </p>
        <h2 className="mt-3 text-lg font-semibold text-ctp-text">Not enough photos yet</h2>
        <p className="mx-auto mt-2 max-w-sm text-sm text-ctp-subtext0">
          The guessing game needs at least {MIN_PLAYABLE} family members with photos — there
          {photographed.length === 1 ? " is " : " are "}
          {photographed.length} so far. Add photos from anyone's profile.
        </p>
        <Link
          to="/"
          className="mt-4 inline-flex rounded-lg bg-ctp-blue px-3 py-1.5 text-sm font-medium text-ctp-base"
        >
          Go to the family table
        </Link>
      </div>
    );
  }

  if (!question) return <p className="text-sm text-ctp-subtext0">Dealing...</p>;

  const answered = picked !== null;
  const wasRight = picked === question.answer.id;

  function choose(id: string) {
    if (answered) return;
    setPicked(id);

    const right = id === question!.answer.id;
    setScore((s) => ({ right: s.right + (right ? 1 : 0), asked: s.asked + 1 }));
    setStreak((s) => {
      const next = right ? s + 1 : 0;
      setBest((b) => Math.max(b, next));
      return next;
    });
  }

  return (
    <div className="mx-auto max-w-md">
      <div className="mb-4 flex items-center gap-4 text-sm">
        <h2 className="font-semibold text-ctp-text">Who's this?</h2>
        <span className="ml-auto text-ctp-subtext0">
          {score.right}/{score.asked}
        </span>
        <span className="text-ctp-peach">
          {streak > 0 ? `🔥 ${streak}` : best > 0 ? `best ${best}` : ""}
        </span>
      </div>

      <div className={`${cardClass} overflow-hidden`}>
        <img
          key={question.answer.id}
          src={photoUrl(question.answer.photoPath!)}
          alt="Guess who this is"
          className="aspect-square w-full bg-ctp-crust object-cover"
        />

        <div className="flex flex-col gap-2 p-4">
          {question.options.map((option) => {
            const isAnswer = option.id === question.answer.id;
            const isPicked = option.id === picked;

            // After answering, always show the right answer in green and a
            // wrong pick in red.
            const state = !answered
              ? "border-ctp-surface1 bg-ctp-surface0 hover:bg-ctp-surface1 text-ctp-text"
              : isAnswer
                ? "border-ctp-green bg-ctp-green/15 text-ctp-green"
                : isPicked
                  ? "border-ctp-red bg-ctp-red/15 text-ctp-red"
                  : "border-ctp-surface0 bg-transparent text-ctp-overlay1";

            return (
              <button
                key={option.id}
                onClick={() => choose(option.id)}
                disabled={answered}
                className={`cursor-pointer rounded-lg border px-3 py-2.5 text-left text-sm
                            font-medium transition disabled:cursor-default ${state}`}
              >
                {option.name}
                {option.nameZh && <span className="ml-2 opacity-70">{option.nameZh}</span>}
                {answered && isAnswer && <span className="float-right">✓</span>}
                {answered && isPicked && !isAnswer && <span className="float-right">✗</span>}
              </button>
            );
          })}
        </div>

        {answered && (
          <div className="border-t border-ctp-surface0 p-4">
            <p className="text-sm text-ctp-subtext1">
              {wasRight ? "Correct!" : `That was ${question.answer.name}.`}
            </p>
            <div className="mt-3 flex gap-2">
              <Button variant="primary" onClick={() => nextQuestion(question.answer.id)} autoFocus>
                Next →
              </Button>
              <Link
                to={`/members/${question.answer.id}`}
                className="inline-flex items-center rounded-lg border border-ctp-surface1
                           bg-ctp-surface0 px-3 py-1.5 text-sm font-medium text-ctp-text
                           transition hover:bg-ctp-surface1"
              >
                See profile
              </Link>
            </div>
          </div>
        )}
      </div>

      <p className="mt-3 text-center text-xs text-ctp-overlay1">
        {photographed.length} of {members.length} family members have photos
      </p>
    </div>
  );
}
