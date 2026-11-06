export const MAX_AVATAR_INPUT_BYTES = 10 * 1024 * 1024;
const SIZE = 512;

/** Center-crop to a square, resize to 512×512 and encode as WebP (q 0.85). */
export async function prepareAvatar(file: File): Promise<Blob> {
  if (file.size > MAX_AVATAR_INPUT_BYTES) throw new Error('Image trop lourde (10 Mo maximum).');
  if (!file.type.startsWith('image/')) throw new Error('Ce fichier n’est pas une image.');
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Traitement de l’image impossible.');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, SIZE, SIZE);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.85));
  if (!blob) throw new Error('Traitement de l’image impossible.');
  return blob;
}
