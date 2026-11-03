import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api, photoUrl } from "../api/client";
import Icon from "../components/icons";
import { Button, EmptyState, Skeleton, cardClass } from "../components/ui";
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

  if (!members) return <Skeleton className="mx-auto h-96 max-w-md" />;

  if (photographed.length < MIN_PLAYABLE) {
    return (
      <div className={cardClass}>
        <EmptyState
          icon="camera"
          title="Not enough photos yet"
          action={
            <Link
              to="/contacts"
              className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-on-brand shadow-sm hover:bg-brand-strong"
            >
              Go to contacts
            </Link>
          }
        >
          The guessing game needs at least {MIN_PLAYABLE} family members with photos — there
          {photographed.length === 1 ? " is " : " are "}
          {photographed.length} so far. Add photos from anyone's profile.
        </EmptyState>
      </div>
    );
  }

  if (!question) return <Skeleton className="mx-auto h-96 max-w-md" />;

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
      <div className="mb-4 flex items-center gap-2.5">
        <h2 className="text-2xl font-semibold text-ctp-text">Who's this?</h2>
        <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-ctp-surface0 px-3 py-1 text-sm font-semibold text-ctp-text">
          <Icon name="check" className="size-3.5 text-ctp-green" />
          {score.right}/{score.asked}
        </span>
        {streak > 0 ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-brand/12 px-3 py-1 text-sm font-semibold text-brand">
            <Icon name="flame" className="size-4" />
            {streak}
          </span>
        ) : (
          best > 0 && <span className="text-sm font-semibold text-ctp-subtext0">best {best}</span>
        )}
      </div>

      <div className={`${cardClass} overflow-hidden`}>
        <img
          key={question.answer.id}
          src={photoUrl(question.answer.photoPath!)}
          alt="Guess who this is"
          className="page-enter aspect-[4/3] w-full sm:aspect-square bg-ctp-crust object-cover"
        />

        <div className="flex flex-col gap-2.5 p-4">
          {question.options.map((option, i) => {
            const isAnswer = option.id === question.answer.id;
            const isPicked = option.id === picked;

            // After answering, always show the right answer in green and a
            // wrong pick in red.
            const state = !answered
              ? "border-ctp-surface1 bg-ctp-mantle hover:border-brand/50 hover:bg-ctp-surface0/60 text-ctp-text"
              : isAnswer
                ? "border-ctp-green bg-ctp-green/12 text-ctp-green"
                : isPicked
                  ? "border-ctp-red bg-ctp-red/12 text-ctp-red"
                  : "border-ctp-surface0 bg-transparent text-ctp-overlay1";

            return (
              <button
                key={option.id}
                onClick={() => choose(option.id)}
                disabled={answered}
                className={`flex cursor-pointer items-center gap-3 rounded-2xl border-2 px-3.5 py-3 text-left text-sm
                            font-semibold transition pointer-coarse:min-h-14 disabled:cursor-default ${state}`}
              >
                <span aria-hidden="true" className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-ctp-surface0/80 text-xs font-bold text-ctp-subtext1">
                  {String.fromCharCode(65 + i)}
                </span>
                <span className="min-w-0 flex-1 truncate">
                  {option.name}
                  {option.nameZh && <span className="ml-2 font-normal opacity-70">{option.nameZh}</span>}
                </span>
                {answered && isAnswer && <Icon name="check" label="Correct answer" className="size-5" />}
                {answered && isPicked && !isAnswer && <Icon name="x" label="Your guess" className="size-5" />}
              </button>
            );
          })}
        </div>

        {answered && (
          <div className="rise-in border-t border-ctp-surface0 p-4">
            <p className={`text-sm font-semibold ${wasRight ? "text-ctp-green" : "text-ctp-subtext1"}`}>
              {wasRight ? "Correct!" : `That was ${question.answer.name}.`}
            </p>
            <div className="mt-3 flex gap-2">
              <Button variant="primary" onClick={() => nextQuestion(question.answer.id)} autoFocus>
                Next →
              </Button>
              <Link
                to={`/members/${question.answer.id}`}
                className="inline-flex items-center rounded-xl border border-ctp-surface1 bg-ctp-mantle px-3.5 py-2 text-sm
                           font-semibold text-ctp-text shadow-sm transition hover:bg-ctp-surface0 pointer-coarse:min-h-11"
              >
                See profile
              </Link>
            </div>
          </div>
        )}
      </div>

      <p className="mt-4 text-center text-xs text-ctp-overlay1">
        {photographed.length} of {members.length} family members have photos
      </p>
    </div>
  );
}
