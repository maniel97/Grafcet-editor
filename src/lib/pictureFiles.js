// Imágenes elegidas por el usuario (en el navegador): a PNG en data URL, a lo más 1200 px, para guardarlas en
// el proyecto. Las .bmp de PC_SIMU también: el navegador las lee y aquí pasan a PNG.
async function loadImageElement(src) {
  return new Promise((resolve, reject) => {
    const i = new Image()
    i.onload = () => resolve(i)
    i.onerror = () => reject(new Error('No se puede leer la imagen.'))
    i.src = src
  })
}

export async function pictureFromFile(file) {
  const url = URL.createObjectURL(file)
  try {
    const img = await loadImageElement(url)
    const k = Math.min(1, 1200 / Math.max(img.naturalWidth, img.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(img.naturalWidth * k))
    canvas.height = Math.max(1, Math.round(img.naturalHeight * k))
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/png')
  } finally {
    URL.revokeObjectURL(url)
  }
}

// El color de la esquina de arriba a la izquierda, transparente (los «gráficos transparentes» de PC_SIMU).
export async function withTransparentCorner(src) {
  if (!src) return src
  const img = await loadImageElement(src)
  const canvas = document.createElement('canvas')
  canvas.width = img.naturalWidth
  canvas.height = img.naturalHeight
  const ctx = canvas.getContext('2d')
  ctx.drawImage(img, 0, 0)
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const px = data.data
  const [r, g, b] = [px[0], px[1], px[2]]
  for (let i = 0; i < px.length; i += 4) if (px[i] === r && px[i + 1] === g && px[i + 2] === b) px[i + 3] = 0
  ctx.putImageData(data, 0, 0)
  return canvas.toDataURL('image/png')
}
