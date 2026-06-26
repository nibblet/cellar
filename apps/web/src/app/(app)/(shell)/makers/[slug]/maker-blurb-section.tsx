import { Divider } from "@/components/primitives";
import { WinstonTastingNote } from "@/components/product";
import { ensureMaker } from "@/lib/makers/load";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ProductType } from "@/lib/wheel";

export async function MakerBlurbSection({
  brand,
  type,
  userId,
}: {
  brand: string;
  type: ProductType;
  userId: string;
}) {
  const supabase = await createSupabaseServerClient();
  const maker = await ensureMaker(supabase, brand, type, userId);
  if (!maker.blurb) return null;

  return (
    <>
      <Divider label="Winston's take" />
      <div className="mb-5">
        <WinstonTastingNote text={maker.blurb} />
      </div>
    </>
  );
}
