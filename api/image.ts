import { Hono } from "hono";
import { handle } from "hono/vercel";
import {
  convertImageToBase64,
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

  const { data, width: origW, height: origH, face } = image!;

  const base64Image = await convertImageToBase64(data, baseUrl);

  const outputAspect = width! / height!;
  const imageAspect = origW / origH;

  let cropW, cropH;

  if (outputAspect > imageAspect) {
    // Output is wider: match width, crop height
    cropW = origW;
    cropH = cropW / outputAspect;
  } else {
    // Output is taller: match height, crop width
    cropH = origH;
    cropW = cropH * outputAspect;
  }

  const centerX = face.x + face.w / 2;
  const centerY = face.y + face.h / 2;

  const viewX = Math.max(0, Math.min(origW - cropW, centerX - cropW / 2));
  const viewY = Math.max(0, Math.min(origH - cropH, centerY - cropH / 2));

  const { greyscale, blur } = parseFilters(c.req.query("filter"));
  const shouldUseFilter = greyscale || blur;

  const filterDefs = shouldUseFilter
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
       width="${width}" height="${height}"
       viewBox="${viewX} ${viewY} ${cropW} ${cropH}">
    ${filterDefs}
    <image x="0" y="0"
           width="${origW}" height="${origH}"
           ${imageFilter}
           preserveAspectRatio="xMidYMid slice"
           xlink:href="${base64Image}" />
  </svg>`;

  return c.text(svg, 200, {
    "Content-Type": "image/svg+xml; charset=UTF-8",
    "Cache-Control": "public, no-cache, must-revalidate",
  });
});

app.get("/health", (c) => c.json({ ok: true }));

export default handle(app);
