function asUint8Array(input: string | Uint8Array): Uint8Array {
  if (typeof input === "string") {
    return new TextEncoder().encode(input);
  }
  return input;
}

export async function sha256Hex(input: string | Uint8Array): Promise<string> {
  const bytes = Uint8Array.from(asUint8Array(input));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function toEtag(value: string): string {
  return `"${value}"`;
}

export function stripEtag(value: string | null): string | null {
  if (!value) {
    return null;
  }
  return value.replace(/^W\//, "").replace(/^"/, "").replace(/"$/, "");
}
