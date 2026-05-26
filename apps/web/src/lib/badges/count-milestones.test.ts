import { describe, expect, it } from "vitest";
import {
  badgeForCount,
  nextMilestoneTarget,
  remainingToNextMilestone,
} from "./count-milestones";

describe("badgeForCount", () => {
  it("returns first badges for counts 1–9 on activity tracks", () => {
    expect(badgeForCount("light", 1)?.mark).toBe("1L");
    expect(badgeForCount("light", 9)?.label).toBe("First Light");
    expect(badgeForCount("smoke", 3)?.mark).toBe("1S");
    expect(badgeForCount("pour", 5)?.mark).toBe("1P");
  });

  it("returns null for contribution below ten", () => {
    expect(badgeForCount("contribution", 0)).toBeNull();
    expect(badgeForCount("contribution", 9)).toBeNull();
  });

  it("replaces first with tenth at ten and increments by ten", () => {
    expect(badgeForCount("light", 10)?.mark).toBe("10L");
    expect(badgeForCount("light", 10)?.label).toBe("Tenth Light");
    expect(badgeForCount("light", 19)?.mark).toBe("10L");
    expect(badgeForCount("light", 20)?.mark).toBe("20L");
    expect(badgeForCount("light", 20)?.label).toBe("Twentieth Light");
    expect(badgeForCount("smoke", 30)?.mark).toBe("30S");
    expect(badgeForCount("contribution", 10)?.mark).toBe("10");
    expect(badgeForCount("contribution", 25)?.mark).toBe("20");
  });

  it("does not show first badge once tenth is earned", () => {
    expect(badgeForCount("pour", 10)?.id).toBe("count:pour:10");
    expect(badgeForCount("pour", 10)?.id).not.toBe("count:pour:first");
  });
});

describe("nextMilestoneTarget", () => {
  it("targets ten then increments by ten", () => {
    expect(nextMilestoneTarget(0)).toBe(10);
    expect(nextMilestoneTarget(9)).toBe(10);
    expect(nextMilestoneTarget(10)).toBe(20);
    expect(nextMilestoneTarget(19)).toBe(20);
    expect(nextMilestoneTarget(20)).toBe(30);
  });
});

describe("remainingToNextMilestone", () => {
  it("counts down to the next milestone", () => {
    expect(remainingToNextMilestone(7)).toBe(3);
    expect(remainingToNextMilestone(10)).toBe(10);
    expect(remainingToNextMilestone(17)).toBe(3);
  });
});
