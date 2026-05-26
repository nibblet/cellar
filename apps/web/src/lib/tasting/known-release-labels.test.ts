import { describe, expect, it } from "vitest";
import {
  collectKnownReleaseLabels,
  KNOWN_RELEASE_LABELS_KEY,
  mergeKnownReleaseLabels,
  sortReleaseLabels,
} from "./known-release-labels";

describe("known-release-labels", () => {
  it("merges specs array, legacy label, and member labels", () => {
    const labels = collectKnownReleaseLabels(
      {
        [KNOWN_RELEASE_LABELS_KEY]: ["2002", "1998"],
        curation_release_label: "#45",
      },
      ["2010", null, "1998"],
    );
    expect(labels).toEqual(["2010", "2002", "1998"]);
  });

  it("falls back to legacy curation_release_label when array missing", () => {
    expect(collectKnownReleaseLabels({ curation_release_label: "#45" }, [])).toEqual(["#45"]);
  });

  it("sorts four-digit years newest first", () => {
    expect(sortReleaseLabels(["1998", "2010", "2002"])).toEqual(["2010", "2002", "1998"]);
  });

  it("dedupes when merging", () => {
    expect(mergeKnownReleaseLabels(["1998"], ["1998", "2001"])).toEqual(["2001", "1998"]);
  });
});
