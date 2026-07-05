import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { HomeHuntNextPick, HomeTryNextPick } from "@/lib/cellar/home-v2";
import { HuntNextRail, TonightsPickCard, TryNextSection } from "./home-v2-sections";

function tryNextPick(
  overrides: Partial<HomeTryNextPick> & Pick<HomeTryNextPick, "product_id" | "name" | "product_type">,
): HomeTryNextPick {
  const { product_id, name, product_type, ...rest } = overrides;
  return {
    kind: "product",
    source: "cellar",
    product_id,
    name,
    brand: null,
    product_type,
    suggestion_kind: "try_tonight",
    rationale: undefined,
    image_url: null,
    ...rest,
  };
}

function huntNextPick(
  overrides: Partial<HomeHuntNextPick> &
    Pick<HomeHuntNextPick, "product_id" | "name" | "product_type">,
): HomeHuntNextPick {
  const { product_id, name, product_type, ...rest } = overrides;
  return {
    kind: "product",
    source: "catalog",
    product_id,
    name,
    brand: null,
    product_type,
    suggestion_kind: "hunt_next",
    rationale: "Fits the sweeter side of your palate.",
    image_url: null,
    tier: null,
    rarityLabel: null,
    ...rest,
  };
}

describe("TryNextSection", () => {
  it("renders only the next two bourbons and next two cigars", () => {
    render(
      <TryNextSection
        bourbons={[
          tryNextPick({
            product_id: "b1",
            name: "Weller 12",
            product_type: "bourbon",
            image_url: "/weller.png",
          }),
          tryNextPick({
            product_id: "b2",
            name: "Blanton's",
            product_type: "bourbon",
            image_url: "/blantons.png",
          }),
          tryNextPick({
            product_id: "b3",
            name: "Booker's",
            product_type: "bourbon",
            image_url: "/bookers.png",
          }),
        ]}
        cigars={[
          tryNextPick({
            product_id: "c1",
            name: "Padron 1964",
            product_type: "cigar",
            image_url: "/padron.png",
          }),
          tryNextPick({
            product_id: "c2",
            name: "Oliva Serie V",
            product_type: "cigar",
            image_url: "/oliva.png",
          }),
          tryNextPick({
            product_id: "c3",
            name: "Liga No. 9",
            product_type: "cigar",
            image_url: "/liga.png",
          }),
        ]}
      />,
    );

    expect(screen.getByText("Try next")).toBeInTheDocument();
    expect(screen.getByText("From your humidor")).toBeInTheDocument();
    expect(screen.getByText("Weller 12")).toBeInTheDocument();
    expect(screen.getByText("Blanton's")).toBeInTheDocument();
    expect(screen.getByText("Padron 1964")).toBeInTheDocument();
    expect(screen.getByText("Oliva Serie V")).toBeInTheDocument();
    expect(screen.queryByText("Booker's")).toBeNull();
    expect(screen.queryByText("Liga No. 9")).toBeNull();
    expect(screen.getByAltText("Weller 12")).toHaveAttribute("src", "/weller.png");
    expect(screen.getByAltText("Padron 1964")).toHaveAttribute("src", "/padron.png");
  });
});

describe("HuntNextRail", () => {
  it("renders rarity stamps and forwards Want taps", () => {
    const onWant = vi.fn();

    render(
      <HuntNextRail
        items={[
          huntNextPick({
            product_id: "b1",
            name: "George T. Stagg",
            product_type: "bourbon",
            rarityLabel: "Lottery",
          }),
        ]}
        onWant={onWant}
      />,
    );

    expect(screen.getByText("Hunt next")).toBeInTheDocument();
    expect(screen.getByText("Worth the chase")).toBeInTheDocument();
    expect(screen.getByText("Lottery")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /\+ want/i }));
    expect(onWant).toHaveBeenCalledWith("b1");
  });
});

describe("TonightsPickCard", () => {
  it("renders the poster metadata row", () => {
    render(
      <TonightsPickCard
        line="The maduro's cocoa wants a wheated pour."
        href="/pairings/c1/b1"
        cigarName="Padron 1964"
        bourbonName="Weller 12"
        cigarImageUrl="/padron.png"
        bourbonImageUrl="/weller.png"
        quote="The maduro's cocoa wants a wheated pour."
        noteNumber="No 01"
      />,
    );

    expect(screen.getByText("Tonight's pick")).toBeInTheDocument();
    expect(screen.getByText("No 01")).toBeInTheDocument();
    expect(screen.getByAltText("Padron 1964")).toHaveAttribute("src", "/padron.png");
    expect(screen.getByAltText("Weller 12")).toHaveAttribute("src", "/weller.png");
    expect(screen.queryByText("Cigar")).toBeNull();
    expect(screen.queryByText("Bourbon")).toBeNull();
    expect(screen.queryByText("at browse 1")).toBeNull();
    expect(screen.queryByText("at browse 2")).toBeNull();
  });
});
