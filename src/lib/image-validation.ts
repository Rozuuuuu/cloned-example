/** Client-side rules for catalog specimen photos. */
export const PHOTO_RULES = {
  types: ["image/jpeg", "image/png", "image/webp", "image/avif"],
  maxBytes: 5 * 1024 * 1024,
  minSide: 200,
  maxSide: 6000,
};

export const PHOTO_HINT =
  "JPEG, PNG, WebP or AVIF · up to 5 MB · between 200 and 6000 px per side.";

const readSize = (file: File | Blob) =>
  new Promise<{ width: number; height: number } | null>((resolve) => {
    if (typeof window === "undefined" || typeof Image === "undefined") return resolve(null);
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });

/** Returns an error message, or null when the file is acceptable. */
export const validatePhoto = async (file: File): Promise<string | null> => {
  if (!PHOTO_RULES.types.includes(file.type)) {
    return `Unsupported file type${file.type ? ` (${file.type})` : ""}. Use JPEG, PNG, WebP or AVIF.`;
  }
  if (file.size > PHOTO_RULES.maxBytes) {
    return `File is ${(file.size / 1024 / 1024).toFixed(1)} MB — the limit is 5 MB.`;
  }
  const size = await readSize(file);
  if (!size) return null; // cannot measure (e.g. jsdom) — allow
  const { width, height } = size;
  if (Math.min(width, height) < PHOTO_RULES.minSide) {
    return `Image is ${width}×${height} px — each side must be at least 200 px.`;
  }
  if (Math.max(width, height) > PHOTO_RULES.maxSide) {
    return `Image is ${width}×${height} px — each side must be 6000 px or less.`;
  }
  return null;
};
