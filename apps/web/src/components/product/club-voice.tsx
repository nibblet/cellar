import { MemberTakes, RecommendBar, TagCloud } from "@/components/group-voice";
import { Card } from "@/components/primitives";
import type { GroupVoice, MemberTake } from "@/lib/aggregation/group-voice";
import type { ProductType } from "@/lib/wheel";

type ClubVoiceProps = {
  productType: ProductType;
  groupVoice: GroupVoice;
  otherTakes: MemberTake[];
  myTake: MemberTake | undefined;
};

/**
 * Single editorial container for everything the club has said about this
 * product. Replaces the original stack of three separate Cards (recommend
 * bar / takes / your tasting) with one panel that uses hairline rules as
 * internal section breaks — the etched divider is reserved for chapter
 * changes, not the variations within a chapter.
 */
export function ClubVoice({ productType, groupVoice, otherTakes, myTake }: ClubVoiceProps) {
  return (
    <Card className="px-5 py-5">
      <RecommendBar
        productType={productType}
        recommendCount={groupVoice.recommend_count}
        memberCount={groupVoice.member_count}
      />

      {groupVoice.tag_cloud.length > 0 ? (
        <>
          <Hairline />
          <TagCloud entries={groupVoice.tag_cloud} />
        </>
      ) : null}

      {otherTakes.length > 0 ? (
        <>
          <Hairline />
          <p className="text-[10px] uppercase tracking-widest text-foreground-subtle mb-3">
            What the members noted
          </p>
          <MemberTakes takes={otherTakes} />
        </>
      ) : null}

      {myTake ? (
        <>
          <Hairline />
          <YourTake take={myTake} />
        </>
      ) : null}
    </Card>
  );
}

function Hairline() {
  return <div className="my-5 h-px bg-border" aria-hidden="true" />;
}

function YourTake({ take }: { take: MemberTake }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-widest text-foreground-subtle mb-2">
        Your tasting
      </p>
      <p className="text-sm">
        <span
          className={take.recommend ? "text-ember-500" : "text-foreground-subtle"}
          aria-hidden="true"
        >
          ●
        </span>{" "}
        {take.recommend ? "You recommend this." : "You passed on this."}
      </p>
      {take.chips.length > 0 ? (
        <div className="flex flex-wrap gap-1.5 mt-2">
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
      {take.note ? <p className="text-sm text-foreground italic mt-2">"{take.note}"</p> : null}
    </div>
  );
}
