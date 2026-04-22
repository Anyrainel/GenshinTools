/**
 * Fetch a gzipped JSON asset and return the decoded value.
 *
 * Beta game-data files ship as ``*.json.gz`` so that their plaintext contents
 * are not indexed by GitHub code search. Import the asset via
 * ``import("....json.gz?url")`` and pass the resolved URL here.
 *
 * Some HTTP servers (Vite's dev server, certain CDNs) recognize the ``.gz``
 * suffix and add ``Content-Encoding: gzip`` to the response, causing the
 * browser to auto-decompress before our code sees the bytes. We detect this
 * by sniffing the gzip magic number (0x1F 0x8B) on the response payload and
 * decompress manually only when the bytes are still gzipped.
 *
 * Relies on the built-in ``DecompressionStream("gzip")`` API, available in all
 * modern browsers (Chrome 80+, Firefox 113+, Safari 16.4+) and Node 18+.
 */
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
