/** A picture shrunk to fit in `max` pixels (a JPEG), so avatars stay a few kilobytes on disk, in the sync and on a phone. Never enlarges. */
export async function shrinkImage(file: Blob, max = 256): Promise<Blob> {
  const bmp = await createImageBitmap(file)
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(bmp.width * scale))
  canvas.height = Math.max(1, Math.round(bmp.height * scale))
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height)
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not read that picture'))), 'image/jpeg', 0.85))
}
