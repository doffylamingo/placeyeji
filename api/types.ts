export interface Dimensions {
  width?: number;
  height?: number;
}

export interface Filters {
  greyscale: boolean;
  blur: boolean;
}

export interface ImageMeta {
  data: string;
  source: string;
  width: number;
  height: number;
  face: FaceCoords;
}

interface FaceCoords {
  x: number;
  y: number;
  w: number;
  h: number;
}
