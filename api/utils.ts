import { Context } from "hono";
import { Dimensions, Filters, ImageMeta } from "./types";

let imageMetaCache: ImageMeta[] | null = null;
export async function getImageMeta(
  baseUrl: string
): Promise<ImageMeta[] | null> {
  if (imageMetaCache) return imageMetaCache;

  const res = await fetch(new URL("/meta.json", baseUrl).toString(), {
    cache: "force-cache",
  });

  imageMetaCache = await res.json();

  return imageMetaCache;
}

export async function getRandomImage(baseUrl: string): Promise<string | null> {
  const images = await getImageMeta(baseUrl);

  if (!images || images.length === 0) {
    return null;
  }

  const image = images[Math.floor(Math.random() * images.length)];

  return await convertImageToBase64(image.data, baseUrl);
}

async function convertImageToBase64(imgSrc: string, baseUrl: string) {
  const abs = new URL(imgSrc, baseUrl).toString();
  const response = await fetch(abs, { cache: "force-cache" });
  const arrayBuffer = await response.arrayBuffer();

  const base64 = btoa(
    Array.from(new Uint8Array(arrayBuffer))
      .map((byte) => String.fromCharCode(byte))
      .join("")
  );

  const mimeType = response.headers.get("Content-Type") ?? "image/jpeg";

  return `data:${mimeType};base64,${base64}`;
}

export function getBaseUrl(c: Context): string {
  const url = new URL(c.req.url);
  return `${url.protocol}//${url.host}`;
}

export function parseFilters(filterQuery?: string): Filters {
  const filters = filterQuery?.split(",") || [];
  return {
    greyscale: filters.includes("greyscale"),
    blur: filters.includes("blur"),
  };
}

export function parseDimensions(w?: string, h?: string): Dimensions {
  const width = w ? Number(w) : undefined;
  const height = h ? Number(h) : width;
  return { width, height };
}

export function validateDimensions({ width, height }: Dimensions): boolean {
  const isValidDimension = (dim?: number) =>
    dim === undefined || (Number.isFinite(dim) && dim >= 1);

  return isValidDimension(width) && isValidDimension(height);
}
