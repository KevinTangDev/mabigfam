// @vitest-environment jsdom
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { mount, settle, unmount } from "./renderHelper";
import type { FamilyMember } from "../src/types";

async function click(el: Element) {
  await act(async () => {
    el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await Promise.resolve();
  });
}

const listMembers = vi.fn();

vi.mock("../src/api/client", () => ({
  api: { listMembers: () => listMembers() },
  photoUrl: (key: string) => `/api/photos/${key}`,
}));

function member(id: string, name: string, photoPath: string | null): FamilyMember {
  return {
    id,
    name,
    nameZh: null,
    birthday: null,
    phone: null,
    address: null,
    note: null,
    photoPath,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    deletedAt: null,
  };
}

/** The options are always the second child of the img's parent card — the
 *  third child (post-answer Next/See-profile controls) uses the shared
 *  `Button` component, which shares enough classes with the option buttons
 *  that a class- or tag-based selector alone can't tell them apart. */
function optionButtons(container: HTMLElement): HTMLButtonElement[] {
  const card = container.querySelector("img")!.parentElement!;
  return [...card.children[1]!.querySelectorAll("button")] as HTMLButtonElement[];
}

async function renderGame() {
  const { default: GameView } = await import("../src/pages/GameView");
  return mount(
    <MemoryRouter>
      <GameView />
    </MemoryRouter>,
  );
}

afterEach(() => {
  unmount();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe("GameView", () => {
  it("asks for more photos when fewer than 3 members have one", async () => {
    listMembers.mockResolvedValue([
      member("a", "Kevin", "photo-a.jpg"),
      member("b", "Mou", "photo-b.jpg"),
      member("c", "No photo", null),
    ]);
    const container = await renderGame();
    await settle();

    expect(container.textContent).toContain("Not enough photos yet");
    expect(container.textContent).toContain("2 so far");
  });

  it("deals a question with 4 choices once enough members have photos", async () => {
    listMembers.mockResolvedValue([
      member("a", "Kevin", "photo-a.jpg"),
      member("b", "Mou", "photo-b.jpg"),
      member("c", "Hung", "photo-c.jpg"),
      member("d", "Thierry", "photo-d.jpg"),
    ]);
    const container = await renderGame();
    await settle();

    expect(container.querySelector("img")).toBeTruthy();
    expect(optionButtons(container).length).toBe(4);
    expect(container.textContent).toContain("0/0");
  });

  it("scores an answer, reveals the correct one, and disables further picks", async () => {
    listMembers.mockResolvedValue([
      member("a", "Kevin", "photo-a.jpg"),
      member("b", "Mou", "photo-b.jpg"),
      member("c", "Hung", "photo-c.jpg"),
      member("d", "Thierry", "photo-d.jpg"),
    ]);
    const container = await renderGame();
    await settle();

    const buttons = optionButtons(container);
    await click(buttons[0]!);

    // Exactly one button is revealed as the correct answer, and every
    // button is now disabled regardless of which one was picked.
    const marked = buttons.filter((b) => b.textContent?.includes("✓"));
    expect(marked.length).toBe(1);
    expect(buttons.every((b) => b.disabled)).toBe(true);
    expect(container.textContent).toMatch(/[01]\/1/);
  });

  it("deals a new question when Next is clicked", async () => {
    listMembers.mockResolvedValue([
      member("a", "Kevin", "photo-a.jpg"),
      member("b", "Mou", "photo-b.jpg"),
      member("c", "Hung", "photo-c.jpg"),
      member("d", "Thierry", "photo-d.jpg"),
    ]);
    const container = await renderGame();
    await settle();

    const firstButtons = optionButtons(container);
    await click(firstButtons[0]!);

    const nextBtn = [...container.querySelectorAll("button")].find((b) => b.textContent === "Next →")!;
    await click(nextBtn);
    await settle();

    const afterButtons = optionButtons(container);
    expect(afterButtons.length).toBe(4);
    expect(afterButtons.every((b) => !b.disabled)).toBe(true);
    expect(container.textContent).toMatch(/[01]\/1/); // score kept, still just one question asked so far
  });
});
