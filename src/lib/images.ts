/** Client-side image optimisation before upload (no server image service needed). */

export const MAX_UPLOAD_BYTES = 12 * 1024 * 1024
export const PROOF_MAX_BYTES = 10 * 1024 * 1024
export const PROOF_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export function assertImage(file: File) {
  if (!IMAGE_TYPES.includes(file.type)) throw new Error('Use uma foto JPG, PNG ou WebP.')
  if (file.size > MAX_UPLOAD_BYTES) throw new Error('A foto passa de 12 MB.')
}

async function loadBitmap(file: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if ('createImageBitmap' in window) {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions)
    } catch {
      /* fall back */
    }
  }
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    return img
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function resizeToWebp(file: Blob, maxSide: number, quality = 0.82): Promise<Blob> {
  const bmp = await loadBitmap(file)
  const w = 'width' in bmp ? bmp.width : 0
  const h = 'height' in bmp ? bmp.height : 0
  const scale = Math.min(1, maxSide / Math.max(w, h))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(w * scale)
  canvas.height = Math.round(h * scale)
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(bmp as CanvasImageSource, 0, 0, canvas.width, canvas.height)
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/webp', quality))
  if (!blob) throw new Error('Não foi possível processar a imagem.')
  return blob
}

/** Full (1600px) + thumbnail (480px) WebP versions of a card photo. */
export async function prepareCardPhoto(file: File) {
  assertImage(file)
  const [full, thumb] = await Promise.all([resizeToWebp(file, 1600, 0.84), resizeToWebp(file, 480, 0.78)])
  return { full, thumb }
}
