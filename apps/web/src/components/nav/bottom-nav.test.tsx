import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BottomNav } from "./bottom-nav";

const mockedUsePathname = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  usePathname: mockedUsePathname,
}));

describe("BottomNav", () => {
  beforeEach(() => {
    mockedUsePathname.mockReturnValue("/");
  });

  it("renders Cellar, Catalog, Pairings, You, and Capture in order", () => {
    render(<BottomNav />);

    const links = screen.getAllByRole("link");
    expect(links.map((link) => link.getAttribute("aria-label") ?? link.textContent?.trim())).toEqual([
      "Cellar",
      "Catalog",
      "Capture",
      "Pairings",
      "You",
    ]);

    expect(screen.getByRole("link", { name: /cellar/i })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: /catalog/i })).toHaveAttribute("href", "/catalog");
    expect(screen.getByRole("link", { name: /pairings/i })).toHaveAttribute("href", "/pairings");
    expect(screen.getByRole("link", { name: /you/i })).toHaveAttribute("href", "/you");
    expect(screen.getByRole("link", { name: /capture/i })).toHaveAttribute("href", "/capture");
  });

  it("marks Cellar as current on the home route", () => {
    render(<BottomNav />);
    expect(screen.getByRole("link", { name: /cellar/i })).toHaveAttribute("aria-current", "page");
  });
});
