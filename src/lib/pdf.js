import * as pdfjs from 'pdfjs-dist'
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjs.GlobalWorkerOptions.workerSrc = workerSrc

const docCache = new Map()
const pageCache = new Map()

async function loadPdf(src) {
  if (!docCache.has(src)) {
    docCache.set(
      src,
      pdfjs.getDocument({
        url: src,
        withCredentials: false,
      }).promise,
    )
  }
  return docCache.get(src)
}

export async function renderPdfPage(src, pageNumber = 1, scale = 1.35) {
  const key = `${src}::${pageNumber}::${scale}`
  if (pageCache.has(key)) return pageCache.get(key)

  const task = (async () => {
    const pdf = await loadPdf(src)
    const page = await pdf.getPage(Math.min(Math.max(1, pageNumber), pdf.numPages))
    const viewport = page.getViewport({ scale })
    const canvas = document.createElement('canvas')
    canvas.width = Math.ceil(viewport.width)
    canvas.height = Math.ceil(viewport.height)
    const context = canvas.getContext('2d', { alpha: false })
    context.fillStyle = '#fff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    await page.render({ canvasContext: context, viewport }).promise
    return {
      dataUrl: canvas.toDataURL('image/jpeg', 0.86),
      pageCount: pdf.numPages,
      width: canvas.width,
      height: canvas.height,
    }
  })()

  pageCache.set(key, task)
  try {
    return await task
  } catch (error) {
    pageCache.delete(key)
    throw error
  }
}

export async function getPdfPageCount(src) {
  const pdf = await loadPdf(src)
  return pdf.numPages
}
