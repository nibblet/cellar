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
    mockedUsePathname.mockReturnValue("/you");
  });

  it("renders You, Cellar, Catalog, Settings, and Capture", () => {
    render(<BottomNav />);

    expect(screen.getByRole("link", { name: /you/i })).toHaveAttribute("href", "/you");
    expect(screen.getByRole("link", { name: /cellar/i })).toHaveAttribute("href", "/cellar");
    expect(screen.getByRole("link", { name: /catalog/i })).toHaveAttribute("href", "/catalog");
    expect(screen.getByRole("link", { name: /settings/i })).toHaveAttribute("href", "/settings");
    expect(screen.getByRole("link", { name: /capture/i })).toHaveAttribute("href", "/capture");
    expect(screen.queryByRole("link", { name: /pairings/i })).toBeNull();
  });

  it("marks You as current on the home route", () => {
    render(<BottomNav />);
    expect(screen.getByRole("link", { name: /you/i })).toHaveAttribute("aria-current", "page");
  });
});
