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

export function rotateSignature(source, direction) {
  return loadSignature(source).then((image) => {
    const canvas = document.createElement('canvas')
    const quarter = Math.abs(direction) % 2 === 1
    canvas.width = quarter ? image.height : image.width
    canvas.height = quarter ? image.width : image.height
    const ctx = canvas.getContext('2d')
    ctx.translate(canvas.width / 2, canvas.height / 2)
    ctx.rotate((direction * Math.PI) / 2)
    ctx.drawImage(image, -image.width / 2, -image.height / 2)
    return canvas.toDataURL('image/png')
  })
}

export function cropSignature(source, box) {
  return loadSignature(source).then((image) => {
    const sx = clamp(Math.round(box.x * image.width), 0, image.width - 1)
    const sy = clamp(Math.round(box.y * image.height), 0, image.height - 1)
    const sw = clamp(Math.round(box.w * image.width), 1, image.width - sx)
    const sh = clamp(Math.round(box.h * image.height), 1, image.height - sy)
    const canvas = document.createElement('canvas')
    canvas.width = sw
    canvas.height = sh
    canvas.getContext('2d').drawImage(image, sx, sy, sw, sh, 0, 0, sw, sh)
    return canvas.toDataURL('image/png')
  })
}

function loadSignature(source) {
  if (typeof source !== 'string' || !source.startsWith('data:image/')) {
    return Promise.reject(new Error('Upload a signature image before rotating or cropping it.'))
  }
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('That signature could not be read.'))
    image.src = source
  })
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

export function cleanSignatureSource(source) {
  if (typeof source !== 'string' || !source.startsWith('data:image/')) return Promise.resolve(source)
  return new Promise((resolve) => {
    const image = new Image()
    image.onload = () => {
      try {
        resolve(inkSignature(image))
      } catch {
        resolve(source)
      }
    }
    image.onerror = () => resolve(source)
    image.src = source
  })
}

function inkSignature(image) {
  const scale = Math.min(1, 900 / image.width)
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(image.width * scale))
  canvas.height = Math.max(1, Math.round(image.height * scale))
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const data = pixels.data
  const histogram = new Uint32Array(256)
  for (let index = 0; index < data.length; index += 4) {
    if (data[index + 3] < 16) continue
    histogram[lumaOf(data[index], data[index + 1], data[index + 2])] += 1
  }
  let background = 245
  let peak = 0
  for (let shade = 90; shade < 256; shade += 1) {
    if (histogram[shade] > peak) {
      peak = histogram[shade]
      background = shade
    }
  }
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
      const chroma = Math.max(red, green, blue) - Math.min(red, green, blue)
      const luma = lumaOf(red, green, blue)
      const neutral = chroma < 42
      const paper = neutral && (
        luma >= 158
        || (background >= 100 && Math.abs(luma - background) <= 36 && luma >= 96)
      )
      if (paper) {
        data[index] = 0
        data[index + 1] = 0
        data[index + 2] = 0
        data[index + 3] = 0
      } else if (neutral && luma > background - 58 && luma < background) {
        data[index + 3] = Math.min(data[index + 3], Math.max(0, Math.round(((background - luma - 26) / 32) * 255)))
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
  const outScale = Math.min(1, 900 / sw, 360 / sh)
  const out = document.createElement('canvas')
  out.width = Math.max(1, Math.round(sw * outScale))
  out.height = Math.max(1, Math.round(sh * outScale))
  out.getContext('2d').drawImage(canvas, sx, sy, sw, sh, 0, 0, out.width, out.height)
  return out.toDataURL('image/png')
}

function lumaOf(red, green, blue) {
  return (0.2126 * red + 0.7152 * green + 0.0722 * blue) | 0
}
