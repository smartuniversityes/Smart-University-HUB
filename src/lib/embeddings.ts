import "server-only";

/**
 * Embeddings travel between SQLite and the model as Float32 buffers. Keeping
 * the encode/decode pair here (instead of inside the queue or the retriever)
 * avoids pulling either of those modules into the other's import graph.
 */

export function encodeEmbedding(vector: number[]): Buffer<ArrayBuffer> {
  const float32 = new Float32Array(vector);
  // Copy into a fresh ArrayBuffer so the value is backed by a plain
  // ArrayBuffer (not a SharedArrayBuffer), which the Prisma Bytes field expects.
  const copy = new ArrayBuffer(float32.byteLength);
  new Float32Array(copy).set(float32);
  return Buffer.from(copy);
}

export function decodeEmbedding(buffer: Buffer): Float32Array {
  return new Float32Array(
    buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
  );
}
