import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { AuthForm } from "./auth-form";

vi.mock("next/navigation", () => ({ useRouter: () => ({}) }));

vi.mock("react-hook-form", async (importOriginal) => {
  const library = await importOriginal<typeof import("react-hook-form")>();
  return {
    ...library,
    useForm: (...args: Parameters<typeof library.useForm>) => {
      const form = library.useForm(...args);
      return {
        ...form,
        formState: {
          ...form.formState,
          errors: {
            password: { type: "server", message: "Check your password." },
          },
        },
      };
    },
  };
});

it.each([
  ["login", 2],
  ["register", 5],
  ["reset", 1],
] as const)(
  "associates the %s labels with their controls",
  (initialMode, count) => {
    const markup = renderToStaticMarkup(
      createElement(AuthForm, { initialMode }),
    );
    const labels = [...markup.matchAll(/<label\b([^>]*)>/g)];
    const inputs = markup.match(/<input\b[^>]*>/g) ?? [];
    expect(labels).toHaveLength(count);
    expect(inputs).toHaveLength(count);
    const ids = labels.map(([, attrs]) => attrs.match(/\bfor="([^"]+)"/)?.[1]);
    expect(ids.every(Boolean)).toBe(true);
    expect(new Set(ids).size).toBe(count);
    for (const id of ids) {
      expect(
        inputs.filter((input) => input.includes(` id="${id}"`)),
      ).toHaveLength(1);
    }
  },
);

it("describes an invalid registration password with its hint and field error", () => {
  const markup = renderToStaticMarkup(
    createElement(AuthForm, { initialMode: "register" }),
  );
  const password = markup.match(/<input\b[^>]*name="password"[^>]*>/)?.[0];
  const email = markup.match(/<input\b[^>]*name="email"[^>]*>/)?.[0];
  expect(password).toContain('aria-invalid="true"');
  expect(email).not.toContain("aria-invalid");
  const descriptions = password
    ?.match(/aria-describedby="([^"]+)"/)?.[1]
    .split(" ");
  expect(descriptions).toHaveLength(2);
  expect(markup).toContain(`id="${descriptions?.[0]}"`);
  expect(markup).toContain(
    `id="${descriptions?.[1]}" class="error-text">Check your password.`,
  );
});
