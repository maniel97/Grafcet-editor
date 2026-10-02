// Nombres de los archivos que se guardan y exportan, a partir del nombre del proyecto.
// Sin nombre se usan los de siempre (grafcet.json, grafcet.pdf, ladder.svg...).
// El lienzo actualiza el nombre al cambiar (setProjectName): así no hay que pasarlo por todas
// las funciones de exportación.

let projectName = ''

export function setProjectName(name) {
  projectName = String(name ?? '')
}

// "Taladradora nº 2 (versión B)" -> "taladradora-n-2-version-b"
export function slugify(text) {
  return String(text)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

// fileName('pdf') -> "taladradora.pdf" (o "grafcet.pdf")
// fileName('svg', 'ladder') -> "taladradora-ladder.svg" (o "ladder.svg")
export function fileName(ext, kind) {
  const base = slugify(projectName)
  if (!base) return `${kind ?? 'grafcet'}.${ext}`
  return `${base}${kind ? `-${kind}` : ''}.${ext}`
}
