export function calculateMagnifyingDisplacementMap(
  canvasWidth: number,
  canvasHeight: number
) {
  const devicePixelRatio =
    typeof window !== "undefined" ? window.devicePixelRatio ?? 1 : 1;
  const bufferWidth = canvasWidth * devicePixelRatio;
  const bufferHeight = canvasHeight * devicePixelRatio;

  const canvas = document.createElement("canvas");
  canvas.width = bufferWidth;
  canvas.height = bufferHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Failed to get canvas context");
  }
  const imageData = ctx.createImageData(bufferWidth, bufferHeight);

  const ratio = Math.max(bufferWidth / 2, bufferHeight / 2);

  for (let y1 = 0; y1 < bufferHeight; y1++) {
    for (let x1 = 0; x1 < bufferWidth; x1++) {
      const idx = (y1 * bufferWidth + x1) * 4;

      const x = x1 - bufferWidth / 2;
      const y = y1 - bufferHeight / 2;

      const rX = x / ratio;
      const rY = y / ratio;

      imageData.data[idx] = 128 - rX * 127;
      imageData.data[idx + 1] = 128 - rY * 127;
      imageData.data[idx + 2] = 0;
      imageData.data[idx + 3] = 255;
    }
  }
  return imageData;
}