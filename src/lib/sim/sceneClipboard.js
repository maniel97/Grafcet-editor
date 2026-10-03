// Portapapeles de la escena de la planta (en esta sesión: se puede pegar en otro proyecto).
// Cada pegado sale un poco más desplazado que el anterior.
const clipboard = { items: [], pastes: 0 }

export function copyToClipboard(items) {
  clipboard.items = items.map((e) => ({ ...e }))
  clipboard.pastes = 0
}

// Copias desplazadas de lo copiado (sin ids nuevos: los pone quien pega). [] si no hay nada.
export function pasteFromClipboard() {
  if (!clipboard.items.length) return []
  const shift = 20 * ++clipboard.pastes
  return clipboard.items.map((e) => ({ ...e, x: e.x + shift, y: e.y + shift }))
}
