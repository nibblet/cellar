export const MEETUP_COUNTDOWN_DAYS = 7;

/** ISO date keys (YYYY-MM-DD) compared in UTC to match events.date storage. */
export function daysUntilMeetup(todayKey: string, eventDateKey: string): number {
  const today = Date.parse(`${todayKey}T00:00:00Z`);
  const event = Date.parse(`${eventDateKey}T00:00:00Z`);
  return Math.round((event - today) / 86_400_000);
}

/** Days until meetup when within the countdown window; null otherwise. */
export function meetupCountdownDays(todayKey: string, eventDateKey: string): number | null {
  const days = daysUntilMeetup(todayKey, eventDateKey);
  if (days < 0 || days > MEETUP_COUNTDOWN_DAYS) return null;
  return days;
}

export function meetupCountdownLabel(daysUntil: number): string {
  if (daysUntil === 0) return "Tonight";
  if (daysUntil === 1) return "Tomorrow";
  return `In ${daysUntil} days`;
}

export function meetupCountdownVoice(eventName: string, daysUntil: number): string {
  if (daysUntil === 0) {
    return `Tonight's the night — ${eventName} is happening. Pour something, tap the group in.`;
  }
  if (daysUntil === 1) {
    return `Tomorrow night — ${eventName}. Start thinking about what you'll pour.`;
  }
  if (daysUntil === MEETUP_COUNTDOWN_DAYS) {
    return `One week out — ${eventName} is on the calendar.`;
  }
  return `${daysUntil} days until ${eventName}. Time to plan the pour.`;
}
