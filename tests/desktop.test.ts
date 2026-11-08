import { describe, expect, it, vi } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { inflateRawSync } from "zlib";

vi.mock("@/lib/db", () => ({ prisma: {} }));

import { createZip, crc32 } from "@/lib/zip";
import { fileFor } from "@/lib/runtime/local";

/** Reads entries back from the central directory (enough to check our writer). */
function readZip(buf: Buffer) {
  const end = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  const count = buf.readUInt16LE(end + 10);
  let p = buf.readUInt32LE(end + 16);
  const out: Record<string, string> = {};
  for (let i = 0; i < count; i++) {
    const method = buf.readUInt16LE(p + 10);
    const size = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.subarray(p + 46, p + 46 + nameLen).toString("utf8");
    const dataStart = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const data = buf.subarray(dataStart, dataStart + size);
    out[name] = (method === 8 ? inflateRawSync(data) : data).toString("utf8");
    p += 46 + nameLen;
  }
  return out;
}

describe("zip export", () => {
  it("computes the standard CRC-32", () => {
    expect(crc32(Buffer.from("123456789"))).toBe(0xcbf43926);
  });

  it("round-trips stored and deflated entries with UTF-8 names", () => {
    const big = "hello ".repeat(500);
    const zip = createZip([
      { path: "app/src/App.tsx", data: Buffer.from(big) },
      { path: "app/ä.txt", data: Buffer.from("x") },
    ]);
    expect(zip.subarray(0, 4)).toEqual(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
    expect(readZip(zip)).toEqual({ "app/src/App.tsx": big, "app/ä.txt": "x" });
  });
});

describe("local static server paths", () => {
  const root = mkdtempSync(path.join(tmpdir(), "stardoom-site-"));
  mkdirSync(path.join(root, "assets"));
  writeFileSync(path.join(root, "index.html"), "<html></html>");
  writeFileSync(path.join(root, "assets", "a.js"), "1");

  it("serves files and directory indexes inside the root", () => {
    expect(fileFor(root, "/")).toBe(path.join(root, "index.html"));
    expect(fileFor(root, "/assets/a.js?v=1")).toBe(path.join(root, "assets", "a.js"));
  });

  it("never escapes the root", () => {
    expect(fileFor(root, "/../../etc/passwd")).toBeNull();
    expect(fileFor(root, "/%2e%2e/%2e%2e/secret")).toBeNull();
    expect(fileFor(root, "/%E0%A4%A")).toBeNull();
    expect(fileFor(root, "/missing.js")).toBeNull();
  });
});
