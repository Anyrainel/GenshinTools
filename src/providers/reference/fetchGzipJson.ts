export async function fetchGzipJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
  }
  const buf = await res.arrayBuffer();
  const view = new Uint8Array(buf);
  // Gzip magic number: 1F 8B. If present, the response wasn't transparently
  // decompressed by the transport and we still need to gunzip it here.
  const isGzipped = view.length >= 2 && view[0] === 0x1f && view[1] === 0x8b;
  let text: string;
  if (isGzipped) {
    text = await new Response(
      new Blob([buf]).stream().pipeThrough(new DecompressionStream("gzip"))
    ).text();
  } else {
    text = new TextDecoder("utf-8").decode(view);
  }
  return JSON.parse(text) as T;
}
