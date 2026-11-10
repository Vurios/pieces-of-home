import { readStorage, writeStorage } from "../game/core/state";

/**
 * Photos stay on this device only (Game Bible 8). About 24 at most; the
 * oldest makes room for a new one. Each is shrunk to a small JPEG first.
 */
export const PHOTOS_KEY = "poh.photos.v1";
export const MAX_PHOTOS = 24;

export interface Photo {
  at: number;
  data: string;
}

export function readPhotos(): Photo[] {
  try {
    const raw = JSON.parse(readStorage(PHOTOS_KEY) ?? "[]") as unknown;
    return Array.isArray(raw) ? raw.filter((p): p is Photo => typeof p?.data === "string" && typeof p?.at === "number") : [];
  } catch {
    return [];
  }
}

function shrink(dataUrl: string, width: number): Promise<string> {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      const scale = Math.min(1, width / image.width);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(image.width * scale);
      canvas.height = Math.round(image.height * scale);
      canvas.getContext("2d")?.drawImage(image, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.78));
    };
    image.onerror = () => resolve(dataUrl);
    image.src = dataUrl;
  });
}

export async function keepPhoto(dataUrl: string): Promise<{ count: number; full: boolean }> {
  const small = await shrink(dataUrl, 480);
  const photos = readPhotos();
  const full = photos.length >= MAX_PHOTOS;
  const next = [...photos, { at: Date.now(), data: small }].slice(-MAX_PHOTOS);
  writeStorage(PHOTOS_KEY, JSON.stringify(next));
  return { count: next.length, full };
}
