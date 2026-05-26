import { describe, expect, it, vi } from "vitest";
import { logMutationEvent } from "@/lib/api/request-logger";

describe("request-logger - sanitizeValue branches", () => {
  it("sanitizes nested objects and strips blocked keys", () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => undefined);

    logMutationEvent("test.action", "actor-1", {
      userId: "user-1",
      password: "should-be-removed",
      token: "should-be-removed",
      nested: {
        authorization: "hidden",
        visible: "kept"
      }
    });

    expect(spy).toHaveBeenCalledOnce();
    const logged = spy.mock.calls[0][0] as string;
    expect(logged).not.toContain("should-be-removed");
    expect(logged).not.toContain("hidden");
    expect(logged).toContain("user-1");
    expect(logged).toContain("kept");

    spy.mockRestore();
  });

  it("sanitizes arrays within details", () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => undefined);

    logMutationEvent("test.action", "actor-1", {
      items: ["a", "b", "c"],
      mixed: [1, true, null, "text"]
    });

    expect(spy).toHaveBeenCalledOnce();
    const logged = spy.mock.calls[0][0] as string;
    expect(logged).toContain("items");
    expect(logged).toContain('"a"');

    spy.mockRestore();
  });

  it("handles non-serializable values by omitting them", () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => undefined);

    logMutationEvent("test.action", "actor-1", {
      fn: () => "function",
      sym: Symbol("test"),
      valid: "included"
    });

    expect(spy).toHaveBeenCalledOnce();
    const logged = spy.mock.calls[0][0] as string;
    expect(logged).toContain("included");

    spy.mockRestore();
  });

  it("handles null details", () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => undefined);

    logMutationEvent("test.action", "actor-1", null);

    expect(spy).toHaveBeenCalledOnce();
    const logged = spy.mock.calls[0][0] as string;
    expect(logged).toContain("null");

    spy.mockRestore();
  });

  it("handles primitive string details", () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => undefined);

    logMutationEvent("test.action", "actor-1", "simple string");

    expect(spy).toHaveBeenCalledOnce();
    const logged = spy.mock.calls[0][0] as string;
    expect(logged).toContain("simple string");

    spy.mockRestore();
  });
});
