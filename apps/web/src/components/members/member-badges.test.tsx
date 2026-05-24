import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MEMBER_BADGES } from "@/lib/badges/definitions";
import { MemberBadges } from "./member-badges";

describe("MemberBadges variant=hero", () => {
  it("renders the label visibly under each badge", () => {
    const { getByText } = render(<MemberBadges badges={[MEMBER_BADGES.founder]} variant="hero" />);
    const label = getByText("Founder");
    expect(label.className).not.toMatch(/sr-only/);
  });

  it("includes the mark glyph", () => {
    const { getByText } = render(<MemberBadges badges={[MEMBER_BADGES.founder]} variant="hero" />);
    expect(getByText("F")).toBeTruthy();
  });
});
