import { act } from "react";
import type { ReactElement } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";

/**
 * Minimal mount helper built on the app's own react-dom.
 *
 * Deliberately not @testing-library/react: in this npm-workspaces layout it
 * hoists to the root, where `react` isn't installed, so it can't resolve it.
 * Using react-dom directly also guarantees the test renders with exactly the
 * React the app does — which matters, since a React mismatch is precisely the
 * bug these tests exist to catch.
 */
let root: Root | null = null;
let container: HTMLElement | null = null;

export async function mount(element: ReactElement): Promise<HTMLElement> {
  container = document.createElement("div");
  document.body.appendChild(container);
  const created = createRoot(container);
  root = created;

  await act(async () => {
    created.render(element);
  });

  return container;
}

/** Lets pending promises settle and effects flush. */
export async function settle(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
  });
}

export function unmount(): void {
  if (root) {
    act(() => root!.unmount());
    root = null;
  }
  container?.remove();
  container = null;
}
