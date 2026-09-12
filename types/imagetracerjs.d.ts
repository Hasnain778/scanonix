declare module "imagetracerjs" {
  export interface ImageTracerImageData {
    width: number;
    height: number;
    data: Uint8ClampedArray | Uint8Array | Buffer;
  }

  export interface ImageTracerOptions {
    ltres?: number;
    qtres?: number;
    pathomit?: number;
    rightangleenhance?: boolean;
    colorsampling?: number;
    numberofcolors?: number;
    mincolorratio?: number;
    colorquantcycles?: number;
    layering?: number;
    strokewidth?: number;
    linefilter?: boolean;
    scale?: number;
    roundcoords?: number;
    viewbox?: boolean;
    desc?: boolean;
    blurradius?: number;
    blurdelta?: number;
    pal?: Array<{ r: number; g: number; b: number; a: number }>;
  }

  export interface ImageTracerApi {
    imagedataToSVG(
      imageData: ImageTracerImageData,
      options?: ImageTracerOptions | string,
    ): string;
  }

  const ImageTracer: ImageTracerApi;
  export default ImageTracer;
}
