/** URL-safe base64 encoding for BigInt values. */

const B64 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_";

export function toBase64(num: bigint): string {
  if (num === 0n) return "0";
  let result = "";
  let n = num;
  while (n > 0n) {
    result = B64[Number(n % 64n)] + result;
    n /= 64n;
  }
  return result;
}
