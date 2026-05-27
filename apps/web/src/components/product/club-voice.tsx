import { MemberTakes, RecommendBar } from "@/components/group-voice";
import { Card } from "@/components/primitives";
import type { GroupVoice, MemberTake } from "@/lib/aggregation/group-voice";
import type { ProductType } from "@/lib/wheel";

type ClubVoiceProps = {
  productType: ProductType;
  groupVoice: GroupVoice;
  otherTakes: MemberTake[];
  myTake: MemberTake | undefined;
};

export function ClubVoice({
  productType,
  groupVoice,
  otherTakes,
  myTake,
}: ClubVoiceProps) {
  return (
    <Card className="px-5 py-5">
      <RecommendBar
        productType={productType}
        recommendCount={groupVoice.recommend_count}
        memberCount={groupVoice.member_count}
      />

      {otherTakes.length > 0 ? (
        <>
          <Hairline />
          <MemberTakes takes={otherTakes} />
        </>
      ) : null}

      {myTake ? (
        <>
          <Hairline />
          <YourNotes take={myTake} />
        </>
      ) : null}
    </Card>
  );
}

function Hairline() {
  return <div className="my-4 h-px bg-border" aria-hidden="true" />;
}

function YourNotes({ take }: { take: MemberTake }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-widest text-foreground-subtle mb-2">
        Your notes
      </p>
      {take.chips.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {take.chips.map((c) => (
            <span
              key={c}
              className="px-2 py-0.5 rounded-full bg-accent-tint text-xs text-foreground border border-accent"
            >
              {c}
            </span>
          ))}
        </div>
      ) : null}
      {take.note ? (
        <p className="text-sm text-foreground-muted italic mt-2">"{take.note}"</p>
      ) : null}
      {take.chips.length === 0 && !take.note ? (
        <p className="text-sm text-foreground-subtle">No notes recorded.</p>
      ) : null}
    </div>
  );
}
