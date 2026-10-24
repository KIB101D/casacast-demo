import { describe, expect, it } from "vitest";
import { fitWithin } from "./compress";
import { coverAfterDelete, isSameSet, moveItem } from "./order";
import { photoUrl } from "./url";
import { checkImage, MAX_UPLOAD_BYTES } from "./validate";

/** Smallest byte sequence image-size recognises as a PNG of the given size (signature + IHDR). */
function pngHeader(width: number, height: number) {
  const buffer = Buffer.alloc(33);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buffer, 0);
  buffer.writeUInt32BE(13, 8); // IHDR length
  buffer.write("IHDR", 12, "ascii");
  buffer.writeUInt32BE(width, 16);
  buffer.writeUInt32BE(height, 20);
  buffer.writeUInt8(8, 24); // bit depth
  buffer.writeUInt8(6, 25); // colour type RGBA
  return buffer;
}

describe("checkImage", () => {
  it("accepts a real PNG and reports its size", () => {
    expect(checkImage(pngHeader(1600, 1200))).toEqual({
      ok: true,
      width: 1600,
      height: 1200,
      type: "png",
    });
  });

  it("rejects bytes that aren't an image, whatever the file was called", () => {
    const result = checkImage(Buffer.from("<script>alert(1)</script>"));
    expect(result.ok).toBe(false);
  });

  it("rejects photos too small for a listing page", () => {
    const result = checkImage(pngHeader(640, 300));
    expect(result).toMatchObject({ ok: false });
    if (!result.ok) expect(result.error).toMatch(/too small \(640×300\)/);
  });

  it("rejects an empty file", () => {
    expect(checkImage(new Uint8Array())).toMatchObject({ ok: false });
  });

  it("rejects files over the size limit before parsing them", () => {
    const big = Buffer.alloc(MAX_UPLOAD_BYTES + 1);
    pngHeader(2000, 1500).copy(big);
    const result = checkImage(big);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/too large/);
  });
});

describe("moveItem", () => {
  it("moves forward and backward", () => {
    expect(moveItem(["a", "b", "c", "d"], 0, 2)).toEqual(["b", "c", "a", "d"]);
    expect(moveItem(["a", "b", "c", "d"], 3, 1)).toEqual(["a", "d", "b", "c"]);
  });

  it("ignores moves outside the list and leaves the input untouched", () => {
    const input = ["a", "b"];
    expect(moveItem(input, 0, 5)).toEqual(["a", "b"]);
    expect(moveItem(input, -1, 0)).toEqual(["a", "b"]);
    expect(input).toEqual(["a", "b"]);
  });
});

describe("isSameSet", () => {
  it("accepts a reordering", () => {
    expect(isSameSet(["a", "b", "c"], ["c", "a", "b"])).toBe(true);
  });

  it.each([
    [["a", "b"], ["a"]],
    [
      ["a", "b"],
      ["a", "x"],
    ],
    [
      ["a", "b"],
      ["a", "a"],
    ],
    [
      ["a", "b"],
      ["a", "b", "c"],
    ],
  ])("rejects %j → %j", (current, proposed) => {
    expect(isSameSet(current, proposed)).toBe(false);
  });
});

describe("coverAfterDelete", () => {
  const photos = [
    { id: "a", isCover: false },
    { id: "b", isCover: true },
    { id: "c", isCover: false },
  ];

  it("keeps the cover when another photo is deleted", () => {
    expect(coverAfterDelete(photos, "a")).toBe("b");
  });

  it("promotes the first remaining photo when the cover is deleted", () => {
    expect(coverAfterDelete(photos, "b")).toBe("a");
  });

  it("returns null when the last photo goes", () => {
    expect(coverAfterDelete([{ id: "a", isCover: true }], "a")).toBeNull();
  });
});

describe("photoUrl", () => {
  const cloudinary =
    "https://res.cloudinary.com/demo/image/upload/v1712/casacast/properties/x/abc.jpg";

  it("adds a crop for fixed-size thumbnails", () => {
    expect(photoUrl(cloudinary, { width: 400, height: 300 })).toBe(
      "https://res.cloudinary.com/demo/image/upload/c_fill,g_auto,w_400,h_300,f_auto,q_auto/v1712/casacast/properties/x/abc.jpg",
    );
  });

  it("limits width only when no height is given", () => {
    expect(photoUrl(cloudinary, { width: 1200, quality: 80 })).toContain(
      "/upload/c_limit,w_1200,f_auto,q_80/",
    );
  });

  it("leaves local development files alone", () => {
    expect(photoUrl("/uploads/properties/x/abc.webp", { width: 400 })).toBe(
      "/uploads/properties/x/abc.webp?w=400",
    );
  });
});

describe("fitWithin", () => {
  it("shrinks a landscape phone photo to 2000 px wide", () => {
    expect(fitWithin(4032, 3024)).toEqual({ width: 2000, height: 1500 });
  });

  it("shrinks a portrait photo by its height", () => {
    expect(fitWithin(3024, 4032)).toEqual({ width: 1500, height: 2000 });
  });

  it("never enlarges a small photo", () => {
    expect(fitWithin(1200, 800)).toEqual({ width: 1200, height: 800 });
  });
});
