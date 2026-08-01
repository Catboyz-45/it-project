declare module "sharp" {
  type Info = { width: number; height: number };
  type Metadata = { width?: number; height?: number; format?: string };
  interface Sharp {
    rotate(): Sharp;
    resize(options: { width: number; withoutEnlargement: boolean }): Sharp;
    clone(): Sharp;
    webp(options: { quality: number; effort: number }): Sharp;
    avif(options: { quality: number; effort: number }): Sharp;
    metadata(): Promise<Metadata>;
    toBuffer(options: { resolveWithObject: true }): Promise<{ data: Uint8Array; info: Info }>;
  }
  export default function sharp(input: Uint8Array, options?: { failOn?: string; limitInputPixels?: number }): Sharp;
}
