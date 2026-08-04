export type Dimensions = { width: number; height: number };

/**
 * Reduz width/height mantendo proporção, sem nunca ampliar. Usado antes de
 * desenhar o snapshot do challenge (match:verify-response) num canvas — o
 * base64 resultante precisa caber em ANTI_CHEAT_MAX_KEYFRAME_BASE64_LENGTH
 * (~300KB decodificados), então mantemos a resolução do keyframe modesta em
 * vez de tentar ajustar a qualidade JPEG sob medida.
 */
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
