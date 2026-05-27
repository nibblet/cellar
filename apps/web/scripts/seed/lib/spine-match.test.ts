import { describe, expect, it } from "vitest";
import { classifyProduct } from "./spine-match";

describe("classifyProduct — Baker's", () => {
  const distillery = "Jim Beam Distillery";

  it("maps 7 Year shorthand and Single Barrel rows to the same expression", () => {
    const seven = classifyProduct({ name: "Baker's 7 Year", distillery });
    const sb = classifyProduct({ name: "Baker's Single Barrel, 7 Year", distillery });
    expect(seven.expression).toBe("Baker's Single Barrel 7 Year");
    expect(sb.expression).toBe("Baker's Single Barrel 7 Year");
  });
});

describe("classifyProduct — Old Forester", () => {
  const distillery = "Old Forester Distillery";

  it("does not fold King Ranch or Single Barrel into 86 Proof", () => {
    expect(
      classifyProduct({
        name: "Old Forester King Ranch, 48%",
        distillery,
      }).expression,
    ).toBe("Old Forester King Ranch");
    expect(
      classifyProduct({
        name: "Old Forester Single Barrel, 50%",
        distillery,
      }).expression,
    ).toBe("Old Forester Single Barrel");
  });

  it("labels the entry-level bottle as 86 Proof", () => {
    expect(
      classifyProduct({
        name: "Old Forester, 43%",
        distillery,
      }).expression,
    ).toBe("Old Forester 86 Proof");
    expect(
      classifyProduct({
        name: "Old Forester 86 Proof, 43%",
        distillery,
      }).expression,
    ).toBe("Old Forester 86 Proof");
  });
});
