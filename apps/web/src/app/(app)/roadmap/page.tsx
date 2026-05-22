import { Card, Divider, Voice } from "@/components/primitives";
import { SuggestionForm } from "./suggestion-form";

type Item = {
  title: string;
  body: string;
};

const today: Item[] = [
  {
    title: "Capture & recommend",
    body: "Snap a cigar band or bourbon label, tap Recommend to NCCC, optionally add a few flavor words.",
  },
  {
    title: "Browse the club",
    body: "See what the rest of the club has been smoking and pouring on the Feed.",
  },
  {
    title: "The group's voice",
    body: "Tap any product to see who recommends it, what flavors keep coming up, and what bourbon pairs with that cigar.",
  },
  {
    title: "Meetups",
    body: "Tag your tastings to the night and see the screenshot-friendly recap card after.",
  },
  {
    title: "The Daily Pour",
    body: "Winston's daily pick — one cigar and one bourbon, narrated, on your home screen.",
  },
];

const upcoming: Item[] = [
  {
    title: "The Cellar",
    body: "A place for your bourbon shelf and humidor inventory. Bottle levels, cigar counts, what you've already finished. Add bottles straight from the capture screen.",
  },
  {
    title: "The Session",
    body: "Cigars taste through First / Second / Final Third. Bourbon has Nose / Palate / Finish. The app will honor the ritual instead of asking you to summarize it in one chip-list.",
  },
  {
    title: "Going deeper on every product",
    body: "Tap any cigar or bourbon to see a flavor radar with the editorial baseline, every member's personal adjustments, and the club's consensus shape laid on top. No scores. Just the shape.",
  },
  {
    title: "Knowing what you like",
    body: "Pairing Preferences are already in Settings. Next: tune Winston's nightly pick and feed cards to your taste even more tightly.",
  },
  {
    title: "Member badges",
    body: "Small earned marks next to your name — First Light, First Pour, Founder, Host. Flavor, not competition.",
  },
];

export default function RoadmapPage() {
  return (
    <main className="mx-auto max-w-md px-5 py-6 pb-24 flex-1">
      <header className="mb-6">
        <p className="text-sm tracking-widest uppercase text-foreground-subtle">The Club</p>
        <h1 className="text-4xl mt-1">Roadmap</h1>
      </header>

      <Voice className="block mb-6">
        "NCCC is live and we're starting to use it. Winston has the bourbon shelf cataloged, the
        cigar lounge is open, and the pairing engine is reading the room. Here's the path forward."
      </Voice>

      <Divider label="What you can do today" />
      <ul className="flex flex-col gap-3 mb-2">
        {today.map((item) => (
          <li key={item.title}>
            <Card>
              <h2 className="text-lg text-foreground">{item.title}</h2>
              <p className="text-sm text-foreground-muted mt-1">{item.body}</p>
            </Card>
          </li>
        ))}
      </ul>

      <Divider label="Coming up" />
      <ol className="flex flex-col gap-3 mb-2">
        {upcoming.map((item, i) => (
          <li key={item.title}>
            <Card>
              <div className="flex items-baseline gap-3">
                <span className="font-display text-2xl text-accent leading-none">{i + 1}</span>
                <h2 className="text-lg text-foreground">{item.title}</h2>
              </div>
              <p className="text-sm text-foreground-muted mt-2">{item.body}</p>
            </Card>
          </li>
        ))}
      </ol>

      <Divider label="Send Paul a suggestion" />
      <Voice className="block mb-4">
        "This is a hobby project for us — what you ask for is what gets built next."
      </Voice>
      <SuggestionForm />
    </main>
  );
}
