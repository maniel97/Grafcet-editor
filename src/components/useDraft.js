import { useState } from 'react'

// Borrador de un campo de texto mientras se escribe. El valor de verdad (el del diagrama) llega
// un momento después de cada tecla; si el campo lo mostrara directamente, React repondría el
// texto anterior y el cursor saltaría al final. Con el foco, el campo muestra su propio borrador
// (y avisa de cada cambio); al salir, vuelve a mostrar el valor de verdad.
export function useDraft(value) {
  const [draft, setDraft] = useState(null)
  return {
    text: draft ?? value ?? '',
    focus: () => setDraft(value ?? ''),
    blur: () => setDraft(null),
    set: (text) => setDraft(text),
  }
}
