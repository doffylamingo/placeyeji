import { Hono } from "hono";
import { handle } from "hono/vercel";

export const config = {
  runtime: "edge",
};

const app = new Hono();

interface Dimensions {
  width?: number;
  height?: number;
}

interface Filters {
  greyscale: boolean;
  blur: boolean;
}

interface ImageMeta {
  data: string;
  source: string;
  width: number;
  height: number;
}

function parseDimensions(w?: string, h?: string): Dimensions {
  const width = w ? Number(w) : undefined;
  const height = h ? Number(h) : width;
  return { width, height };
}

function validateDimensions({ width, height }: Dimensions): boolean {
  const isValidDimension = (dim?: number) =>
    dim === undefined || (Number.isFinite(dim) && dim >= 1);

  return isValidDimension(width) && isValidDimension(height);
}

function parseFilters(filterQuery?: string): Filters {
  const filters = filterQuery?.split(",") || [];
  return {
    greyscale: filters.includes("greyscale"),
    blur: filters.includes("blur"),
  };
}

let imageMetaCache: ImageMeta[] | null = null;
async function getImageMeta() {
  if (imageMetaCache) return imageMetaCache;

  const res = await fetch(
    new URL(
      "/meta.json",
      new URL("/", process.env.PUBLIC_VERCEL_URL || "http://localhost:3000")
    ).toString(),
    {
      cache: "force-cache",
    }
  );

  imageMetaCache = await res.json();

  return imageMetaCache;
}

async function getRandomImage() {
  const images = await getImageMeta();

  if (!images || images.length === 0) {
    return null;
  }

  const image = images[Math.floor(Math.random() * images.length)];

  return image.data;
}

app.get("/", async (c) => {
  const { width, height } = parseDimensions(c.req.query("w"), c.req.query("h"));

  if (!validateDimensions({ width, height })) {
    return c.text("Invalid dimensions", 400);
  }

  const image = await getRandomImage();

  const { greyscale, blur } = parseFilters(c.req.query("filter"));

  const shouldUseFilter = greyscale || blur;

  const filterDefs =
    greyscale || blur
      ? `<filter id="effects" color-interpolation-filters="sRGB">
      ${
        blur
          ? `<feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blurred" />`
          : ""
      }
      ${
        greyscale
          ? `<feColorMatrix
                in="${blur ? "blurred" : "SourceGraphic"}"
                type="saturate"
                values="0.10" />`
          : ""
      }
    </filter>`
      : "";

  const imageFilter = shouldUseFilter ? `filter="url(#effects)"` : "";

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
  <svg xmlns="http://www.w3.org/2000/svg"
      xmlns:xlink="http://www.w3.org/1999/xlink"
      width="${width}" height="${height}">

    ${filterDefs}

    <image width="${width}" height="${height}"
          ${imageFilter}
          preserveAspectRatio="xMidYMid slice"
          xlink:href="${image}" />
  </svg>`;

  return c.text(svg, 200, {
    "Content-Type": "image/svg+xml; charset=UTF-8",
    "Cache-Control": "public, no-cache, must-revalidate",
  });
});

app.get("/health", (c) => c.json({ ok: true }));

export default handle(app);
