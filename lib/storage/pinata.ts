import "server-only";

/**
 * Token logo uploads to IPFS through Pinata (v3 files API), as used by scripts/pin-pass-metadata.mjs.
 * PINATA_JWT is server-only (a scoped JWT with file-upload permission); PINATA_GATEWAY is for display URLs.
 */
export class PinataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PinataError";
  }
}

export function pinataConfigured(): boolean {
  return !!process.env.PINATA_JWT?.trim();
}

export function ipfsGatewayUrl(cid: string): string {
  const base = (process.env.PINATA_GATEWAY || "https://gateway.pinata.cloud").replace(/\/+$/, "");
  return `${base}/ipfs/${cid}`;
}

export interface ImageKind {
  mime: "image/png" | "image/jpeg" | "image/gif" | "image/webp";
  ext: "png" | "jpg" | "gif" | "webp";
}

/** Identifies an image from its magic bytes; the file name and declared type are never trusted. SVG is refused (scripts). */
export function sniffImage(b: Uint8Array): ImageKind | null {
  if (b.length < 12) return null;
  const at = (i: number, ...sig: number[]) => sig.every((v, j) => b[i + j] === v);
  if (at(0, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return { mime: "image/png", ext: "png" };
  if (at(0, 0xff, 0xd8, 0xff)) return { mime: "image/jpeg", ext: "jpg" };
  if (at(0, 0x47, 0x49, 0x46, 0x38) && (b[4] === 0x37 || b[4] === 0x39) && b[5] === 0x61) return { mime: "image/gif", ext: "gif" };
  if (at(0, 0x52, 0x49, 0x46, 0x46) && at(8, 0x57, 0x45, 0x42, 0x50)) return { mime: "image/webp", ext: "webp" };
  return null;
}

/** Pins one file publicly and returns its CID. */
export async function pinFile(bytes: Uint8Array, filename: string, mime: string, keyvalues: Record<string, string> = {}): Promise<{ cid: string }> {
  const jwt = process.env.PINATA_JWT?.trim();
  if (!jwt) throw new PinataError("Image uploads are not configured on this server.");
  const form = new FormData();
  form.append("file", new Blob([bytes as BlobPart], { type: mime }), filename);
  form.append("network", "public");
  form.append("name", filename);
  if (Object.keys(keyvalues).length) form.append("keyvalues", JSON.stringify(keyvalues));
  let res: Response;
  try {
    res = await fetch("https://uploads.pinata.cloud/v3/files", {
      method: "POST",
      headers: { Authorization: `Bearer ${jwt}` },
      body: form,
      signal: AbortSignal.timeout(60_000),
    });
  } catch {
    throw new PinataError("Could not reach the image host. Try again.");
  }
  const body = (await res.json().catch(() => null)) as { data?: { cid?: string } } | null;
  if (!res.ok || !body?.data?.cid) throw new PinataError(res.status === 401 || res.status === 403 ? "Image uploads are misconfigured on this server." : "Could not upload the image. Try again.");
  return { cid: body.data.cid };
}
