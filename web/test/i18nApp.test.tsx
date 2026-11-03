// @vitest-environment jsdom
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { mount, settle, unmount } from "./renderHelper";
import type { FamilyEvent, FamilyMember, TreeData } from "../src/types";

/**
 * Renders the whole app (real router, providers and pages) over a fake API,
 * once per page and language, to prove switching languages works everywhere
 * and persists — the behavioural counterpart to i18nAudit.test.ts.
 */

function member(id: string, name: string, extra: Partial<FamilyMember> = {}): FamilyMember {
  return {
    id,
    name,
    nameZh: null,
    birthday: null,
    phone: null,
    address: null,
    note: null,
    photoPath: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    deletedAt: null,
    ...extra,
  };
}

const members = [
  member("a", "Hung TANG", { birthday: "1960-08-13T00:00:00.000Z", photoPath: "a.jpg", phone: "+33 6 11 22 33 44" }),
  member("b", "Mou TANG", { birthday: "1954-03-02T00:00:00.000Z", photoPath: "b.jpg" }),
  member("c", "Kevin TANG", { birthday: "1988-03-25T00:00:00.000Z", photoPath: "c.jpg" }),
  member("d", "Thierry TANG", { birthday: "1990-07-13T00:00:00.000Z" }),
];
const tree: TreeData = {
  members,
  links: ["c", "d"].flatMap((child) =>
    ["a", "b"].map((parent) => ({ id: `${parent}${child}`, parentId: parent, childId: child, createdAt: "" })),
  ),
  partnerships: [{ id: "p", aId: "a", bId: "b", status: "married", since: null, createdAt: "", updatedAt: "" }],
};
const events: FamilyEvent[] = [
  { id: "e", title: "Reunion", description: null, location: "Lyon", startsAt: "2099-06-01T00:00:00.000Z", endsAt: null, allDay: true, createdAt: "", updatedAt: "" },
];

vi.mock("../src/api/client", () => ({
  api: {
    getSession: async () => ({ authenticated: true }),
    getTree: async () => tree,
    listMembers: async () => members,
    listLinks: async () => tree.links,
    listEvents: async () => events,
    listTrash: async () => [member("z", "Old Member", { deletedAt: "2026-06-15T10:30:00.000Z" })],
    getMemberRelations: async () => ({ ...members[2]!, parents: [members[0]!, members[1]!], children: [], partners: [] }),
    getCalendarSubscription: async () => ({ path: "/api/calendar/secret/mabigfam.ics" }),
    logout: async () => ({ authenticated: false }),
  },
  setUnauthorizedHandler: () => {},
  downloadFile: vi.fn(),
  photoUrl: (key: string) => `/api/photos/${key}`,
}));

// One string per page that only appears once the page has really loaded its data.
const PAGE_MARKERS: Record<string, { fr: string; zh: string }> = {
  "/": { fr: "Toute votre famille", zh: "全家人，尽在一处" },
  "/contacts": { fr: "Tout le monde", zh: "所有人" },
  "/members/c": { fr: "Frères et sœurs", zh: "兄弟姐妹" },
  "/tree": { fr: "Génération 1", zh: "第1代" },
  "/birthdays": { fr: "Liste", zh: "列表" },
  "/calendar": { fr: "Abonnez-vous une fois", zh: "订阅一次" },
  "/game": { fr: "Qui est-ce", zh: "这是谁" },
  "/trash": { fr: "Supprimer définitivement", zh: "永久删除" },
};
const PAGES = Object.keys(PAGE_MARKERS);
// A dotted identifier shaped like one of our keys, i.e. a missing/leaked translation.
const LEAKED_KEY = /\b(?:nav|common|dash|contacts|detail|bday|tree|cal|sub|game|trash|photo|memberForm|eventForm|export|login|status|rel|error|server|countdown|greeting|added|birthday|theme|lang)\.[A-Za-z]+(?:\.[A-Za-z]+)*\b/;

async function renderApp(path: string) {
  const { I18nProvider } = await import("../src/i18n");
  const { ThemeProvider } = await import("../src/theme/ThemeProvider");
  const { AuthProvider } = await import("../src/auth/AuthContext");
  const { default: App } = await import("../src/App");
  return mount(
    <I18nProvider>
      <ThemeProvider>
        <MemoryRouter initialEntries={[path]}>
          <AuthProvider>
            <App />
          </AuthProvider>
        </MemoryRouter>
      </ThemeProvider>
    </I18nProvider>,
  );
}

const switcherButton = (container: HTMLElement, label: string) =>
  [...container.querySelectorAll("[role=group] button")].find((b) => b.textContent === label) as HTMLButtonElement;

async function chooseLanguage(container: HTMLElement, label: "EN" | "FR" | "中文") {
  await act(async () => {
    switcherButton(container, label).dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await Promise.resolve();
  });
  await settle();
}

/** Text a person would see or hear: visible text plus accessible names and tooltips. */
function userFacingText(container: HTMLElement): string {
  const attrs = [...container.querySelectorAll("[aria-label],[title],[placeholder],[alt]")].flatMap((el) =>
    ["aria-label", "title", "placeholder", "alt"].map((a) => el.getAttribute(a) ?? ""),
  );
  return [container.textContent ?? "", ...attrs].join(" ");
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.lang = "en";
});

afterEach(() => {
  unmount();
  localStorage.clear();
  vi.clearAllMocks();
});

describe("language switcher", () => {
  it("defaults to English and marks EN as the active option", async () => {
    const container = await renderApp("/");
    await settle();

    expect(switcherButton(container, "EN").getAttribute("aria-pressed")).toBe("true");
    expect(switcherButton(container, "FR").getAttribute("aria-pressed")).toBe("false");
    expect(container.textContent).toContain("Your family, all in one place.");
    expect(document.documentElement.lang).toBe("en");
  });

  it("switches instantly, with no reload, and updates <html lang>", async () => {
    const container = await renderApp("/");
    await settle();

    await chooseLanguage(container, "FR");
    expect(container.textContent).toContain("Toute votre famille, au même endroit.");
    expect(container.textContent).not.toContain("Your family, all in one place.");
    expect(switcherButton(container, "FR").getAttribute("aria-pressed")).toBe("true");
    expect(document.documentElement.lang).toBe("fr");

    await chooseLanguage(container, "中文");
    expect(container.textContent).toContain("全家人，尽在一处。");
    expect(document.documentElement.lang).toBe("zh-CN");
  });

  it("remembers the choice in localStorage and restores it on the next visit", async () => {
    let container = await renderApp("/");
    await settle();
    await chooseLanguage(container, "中文");
    expect(localStorage.getItem("mabigfam-lang")).toBe("zh");

    unmount(); // "close the tab"
    container = await renderApp("/contacts");
    await settle();

    expect(container.textContent).toContain("联系人");
    expect(switcherButton(container, "中文").getAttribute("aria-pressed")).toBe("true");
  });

  it("ignores a corrupt saved value and falls back to English", async () => {
    localStorage.setItem("mabigfam-lang", "klingon");
    const container = await renderApp("/");
    await settle();

    expect(switcherButton(container, "EN").getAttribute("aria-pressed")).toBe("true");
  });

  it("translates the theme toggle and sign-out tooltips too", async () => {
    const container = await renderApp("/");
    await settle();
    await chooseLanguage(container, "FR");

    expect(container.querySelector("[aria-label='Changer de thème']")).toBeTruthy();
    expect(container.querySelector("[aria-label='Se déconnecter']")).toBeTruthy();
  });
});

describe.each([
  ["fr", "FR"],
  ["zh", "中文"],
] as const)("every page in %s", (lang, label) => {
  it.each(PAGES)("%s has no leaked keys, no English chrome, and the right locale", async (path) => {
    localStorage.setItem("mabigfam-lang", lang);
    const container = await renderApp(path);
    await settle();
    await settle();

    const text = userFacingText(container);
    expect(text).toContain(PAGE_MARKERS[path]![lang]);
    expect(text.match(LEAKED_KEY)).toBeNull();
    expect(switcherButton(container, label).getAttribute("aria-pressed")).toBe("true");

    // Navigation chrome is translated everywhere.
    for (const english of ["Birthdays", "Calendar", "Sign out", "Toggle colour theme"]) {
      expect(text).not.toContain(english);
    }
    if (lang === "zh") expect(text).toMatch(/\p{Script=Han}/u);
  });
});
