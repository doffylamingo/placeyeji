import { Hono } from "hono";
import { handle } from "hono/vercel";
import {
  getBaseUrl,
  getRandomImage,
  parseDimensions,
  parseFilters,
  validateDimensions,
} from "./utils";

export const config = {
  runtime: "edge",
};

const app = new Hono();

app.get("/image", async (c) => {
  const { width, height } = parseDimensions(c.req.query("w"), c.req.query("h"));
  const baseUrl = getBaseUrl(c);

  if (!validateDimensions({ width, height })) {
    return c.text("Invalid dimensions", 400);
  }

  const image = await getRandomImage(baseUrl);

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
