// Utilities for resolving a Google Docs link/ID and fetching its plain-text export.
// This works for any Google Doc whose sharing is set to "Anyone with the link can view".
// No OAuth or API key is required.

export function extractDocId(input: string): string | null {
  if (!input) return null;
  const trimmed = input.trim();

  // If it looks like a bare ID (no slashes/spaces and reasonable length), accept it.
  if (/^[a-zA-Z0-9_-]{20,}$/.test(trimmed)) {
    return trimmed;
  }

  // Match /document/d/<ID>
  const m = trimmed.match(/\/document\/d\/([a-zA-Z0-9_-]+)/);
  if (m) return m[1];

  // Match ?id=<ID>
  const m2 = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (m2) return m2[1];

  return null;
}

export function buildExportUrl(docId: string): string {
  return `https://docs.google.com/document/d/${encodeURIComponent(
    docId,
  )}/export?format=txt`;
}

export async function fetchDocText(input: string): Promise<string> {
  const id = extractDocId(input);
  if (!id) {
    throw new Error(
      "Could not find a Google Doc ID in that input. Paste the full doc URL.",
    );
  }
  const url = buildExportUrl(id);
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) {
    throw new Error(
      `Failed to load doc (HTTP ${res.status}). Make sure sharing is set to "Anyone with the link can view".`,
    );
  }
  const text = await res.text();

  // If Google returned an HTML sign-in page instead of text, detect and explain.
  const looksLikeHtml = /^\s*<!DOCTYPE html|<html[\s>]/i.test(text);
  if (looksLikeHtml) {
    throw new Error(
      'Google returned a sign-in page. Open the doc, click Share, and set access to "Anyone with the link".',
    );
  }

  // Strip a leading BOM if present.
  return text.replace(/^\uFEFF/, "");
}
