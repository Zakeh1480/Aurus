export type Dimensions = { width: number; height: number };

export function computeDownscaleDimensions(source: Dimensions, maxWidth: number): Dimensions {
  if (source.width <= 0 || source.height <= 0 || maxWidth <= 0) {
    return { width: 0, height: 0 };
  }
  if (source.width <= maxWidth) {
    return { width: Math.round(source.width), height: Math.round(source.height) };
  }
  const scale = maxWidth / source.width;
  return { width: Math.round(maxWidth), height: Math.round(source.height * scale) };
}
