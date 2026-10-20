export function signatureFromFile(file) {
  if (!file || !file.type.startsWith('image/')) {
    return Promise.reject(new Error('Upload a PNG or JPG of the signature on a white background.'))
  }
  if (file.size > 8 * 1024 * 1024) {
    return Promise.reject(new Error('Use a signature image smaller than 8 MB.'))
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      URL.revokeObjectURL(url)
      try {
        resolve(inkSignature(image))
      } catch (error) {
        reject(error)
      }
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('That image could not be read. Use a PNG or JPG.'))
    }
    image.src = url
  })
}

function inkSignature(image) {
  const scale = Math.min(1, 720 / image.width)
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(image.width * scale))
  canvas.height = Math.max(1, Math.round(image.height * scale))
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const data = pixels.data
  let minX = canvas.width
  let minY = canvas.height
  let maxX = 0
  let maxY = 0

  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = 0; x < canvas.width; x += 1) {
      const index = (y * canvas.width + x) * 4
      const red = data[index]
      const green = data[index + 1]
      const blue = data[index + 2]
      const min = Math.min(red, green, blue)
      const max = Math.max(red, green, blue)
      if (min >= 210 && max - min < 28) {
        data[index + 3] = min >= 245 ? 0 : Math.min(data[index + 3], Math.round(((245 - min) / 35) * 255))
      }
      if (data[index + 3] > 24) {
        if (x < minX) minX = x
        if (y < minY) minY = y
        if (x > maxX) maxX = x
        if (y > maxY) maxY = y
      }
    }
  }

  if (maxX <= minX || maxY <= minY) {
    throw new Error('No signature ink was found. Use a dark signature on a white background.')
  }

  ctx.putImageData(pixels, 0, 0)
  const pad = 10
  const sx = Math.max(0, minX - pad)
  const sy = Math.max(0, minY - pad)
  const sw = Math.min(canvas.width - sx, maxX - minX + 1 + pad * 2)
  const sh = Math.min(canvas.height - sy, maxY - minY + 1 + pad * 2)
  const outScale = Math.min(1, 640 / sw, 200 / sh)
  const out = document.createElement('canvas')
  out.width = Math.max(1, Math.round(sw * outScale))
  out.height = Math.max(1, Math.round(sh * outScale))
  out.getContext('2d').drawImage(canvas, sx, sy, sw, sh, 0, 0, out.width, out.height)
  return out.toDataURL('image/png')
}
