export interface ObjectStorage {
  signPut(key: string, contentType: string, contentLength: number, expiresIn: number): Promise<string>;
  signGet(key: string, expiresIn: number, downloadName?: string): Promise<string>;
  head(key: string): Promise<{ size: number; contentType?: string }>;
  get(key: string): Promise<Uint8Array>;
  put(key: string, body: Uint8Array, contentType: string): Promise<void>;
  deleteMany(keys: string[]): Promise<void>;
}
