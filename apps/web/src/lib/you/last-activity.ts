export type LastActivityProduct = {
  type: "cigar" | "bourbon";
  name: string;
};

export function buildLastActivityLine(product: LastActivityProduct | null): string | null {
  if (!product) return null;
  return product.type === "bourbon"
    ? `"You poured ${product.name} last."`
    : `"You lit ${product.name} last."`;
}
