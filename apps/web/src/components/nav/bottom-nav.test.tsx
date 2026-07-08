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

  it("renders Cellar, Shelf, Log, You, and Capture — no Catalog or Pairings", () => {
    render(<BottomNav />);

    expect(screen.getByRole("link", { name: /cellar/i })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: /shelf/i })).toHaveAttribute("href", "/shelf");
    expect(screen.getByRole("link", { name: /log/i })).toHaveAttribute("href", "/log");
    expect(screen.getByRole("link", { name: /you/i })).toHaveAttribute("href", "/you");
    expect(screen.getByRole("link", { name: /capture/i })).toHaveAttribute("href", "/capture");
    expect(screen.queryByRole("link", { name: /catalog/i })).toBeNull();
    expect(screen.queryByRole("link", { name: /pairings/i })).toBeNull();
  });

  it("marks Cellar as current on the home route", () => {
    render(<BottomNav />);
    expect(screen.getByRole("link", { name: /cellar/i })).toHaveAttribute("aria-current", "page");
  });
});
