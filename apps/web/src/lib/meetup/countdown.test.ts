import { describe, expect, it } from "vitest";
import {
  daysUntilMeetup,
  meetupCountdownDays,
  meetupCountdownLabel,
  meetupCountdownVoice,
} from "./countdown";

describe("daysUntilMeetup", () => {
  it("returns 0 for same-day events", () => {
    expect(daysUntilMeetup("2026-06-07", "2026-06-07")).toBe(0);
  });

  it("counts down across month boundaries", () => {
    expect(daysUntilMeetup("2026-06-07", "2026-06-14")).toBe(7);
  });
});

describe("meetupCountdownDays", () => {
  it("returns days within the 7-day window", () => {
    expect(meetupCountdownDays("2026-06-07", "2026-06-14")).toBe(7);
    expect(meetupCountdownDays("2026-06-07", "2026-06-07")).toBe(0);
  });

  it("returns null when meetup is more than 7 days away", () => {
    expect(meetupCountdownDays("2026-06-07", "2026-06-15")).toBeNull();
  });

  it("returns null for past meetups", () => {
    expect(meetupCountdownDays("2026-06-07", "2026-06-06")).toBeNull();
  });
});

describe("meetupCountdownLabel", () => {
  it("labels tonight, tomorrow, and multi-day countdowns", () => {
    expect(meetupCountdownLabel(0)).toBe("Tonight");
    expect(meetupCountdownLabel(1)).toBe("Tomorrow");
    expect(meetupCountdownLabel(7)).toBe("In 7 days");
  });
});

describe("meetupCountdownVoice", () => {
  it("uses tonight copy on meetup day", () => {
    expect(meetupCountdownVoice("June Club Night", 0)).toContain("Tonight's the night");
  });

  it("uses week-out copy at 7 days", () => {
    expect(meetupCountdownVoice("June Club Night", 7)).toContain("One week out");
  });
});
