// @vitest-environment jsdom
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mount, settle, unmount } from "./renderHelper";

async function type(el: Element, value: string) {
  await act(async () => {
    const input = el as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    setter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await Promise.resolve();
  });
}

async function submit(form: Element) {
  await act(async () => {
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await Promise.resolve();
  });
}

const login = vi.fn();

vi.mock("../src/auth/AuthContext", () => ({
  useAuth: () => ({ authenticated: false, login, logout: vi.fn() }),
}));

async function renderLogin() {
  const { default: LoginScreen } = await import("../src/pages/LoginScreen");
  return mount(<LoginScreen />);
}

afterEach(() => {
  unmount();
  vi.clearAllMocks();
});

describe("LoginScreen", () => {
  it("disables sign in until a password is entered", async () => {
    const container = await renderLogin();
    await settle();

    const button = container.querySelector("button[type=submit]") as HTMLButtonElement;
    expect(button.disabled).toBe(true);

    await type(container.querySelector("input")!, "hunter2");
    await settle();
    expect(button.disabled).toBe(false);
  });

  it("submits the typed password", async () => {
    login.mockResolvedValue(undefined);
    const container = await renderLogin();
    await settle();

    await type(container.querySelector("input")!, "hunter2");
    await submit(container.querySelector("form")!);
    await settle();

    expect(login).toHaveBeenCalledWith("hunter2");
  });

  it("shows an error and re-enables the form when login fails", async () => {
    login.mockRejectedValue(new Error("Incorrect password"));
    const container = await renderLogin();
    await settle();

    await type(container.querySelector("input")!, "wrong");
    await submit(container.querySelector("form")!);
    await settle();

    expect(container.textContent).toContain("Incorrect password");
    const button = container.querySelector("button[type=submit]") as HTMLButtonElement;
    expect(button.disabled).toBe(false);
    expect(button.textContent).toBe("Sign in");
  });
});
