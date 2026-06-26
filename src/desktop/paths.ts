function decodeFileUrlPath(url: URL): string {
  try {
    return decodeURIComponent(url.pathname || "");
  } catch {
    return url.pathname || "";
  }
}

function toWindowsSeparators(path: string): string {
  return path.replace(/\//g, "\\");
}

export function normalizeDroppedPath(rawPath: string): string {
  const trimmed = rawPath.trim();
  if (!trimmed) {
    return "";
  }

  if (!trimmed.startsWith("file://")) {
    return trimmed;
  }

  try {
    const url = new URL(trimmed);
    if (url.protocol !== "file:") {
      return trimmed;
    }

    const decodedPath = decodeFileUrlPath(url);
    if (url.host && url.host !== "localhost") {
      return `\\\\${url.host}${toWindowsSeparators(decodedPath)}`;
    }

    if (/^\/[A-Za-z]:\//.test(decodedPath)) {
      return toWindowsSeparators(decodedPath.slice(1));
    }

    return decodedPath;
  } catch {
    return trimmed;
  }
}

export function normalizeDroppedPaths(paths: readonly string[]): string[] {
  return paths
    .map(normalizeDroppedPath)
    .map((path) => path.trim())
    .filter(Boolean);
}
