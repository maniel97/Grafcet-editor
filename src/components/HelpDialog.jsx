import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { SHORTCUTS } from '../lib/shortcuts'

const NOTATION = [
  ['Etapa inicial', 'Doble cuadrado. Activa al arrancar; debe haber al menos una.'],
  ['Macroetapa', 'Cuadrado con trazos arriba y abajo (M1…). Se detalla en otro grafcet.'],
  ['Transición', 'Trazo horizontal con su receptividad a la derecha. Usa 1 si siempre se cumple.'],
  ['Divergencia en O', 'Una etapa con varias transiciones alternativas: línea simple bajo la etapa.'],
  ['Divergencia en Y', 'Una transición que activa varias etapas a la vez: doble línea.'],
  ['Bucle', 'Enlace hacia arriba: por la izquierda y con flecha (los enlaces se leen de arriba abajo).'],
  ['Acción continua', 'Caja simple: activa mientras la etapa está activa.'],
  ['Acción condicionada', 'Trazo vertical encima con la condición. Con tiempo (3s/X2) es retardada.'],
  ['Acción memorizada', 'Flecha ↑ (al activarse la etapa) o ↓ (al desactivarse), p. ej. A:=1.'],
  ['Acción al evento', 'Flecha y evento encima, p. ej. ↑b.'],
  [
    'Tabla de variables en el lienzo',
    'Clic en una dirección o comentario para editarlo; arrastra una variable a otra sección para cambiar su tipo; al pasar por una fila se resaltan los nodos que la usan.',
  ],
  ['Notas', 'Cuadros de texto libres (barra o clic derecho en el lienzo). No forman parte del grafcet: la verificación, la simulación y el ladder las ignoran.'],
  ['Ordenar', 'Selecciona varios nodos y, con clic derecho: Alinear en columna o Espaciar la secuencia (distancias estándar).'],
  ['Abrir', 'Archivo .json, Ejemplos (taladradora, cilindros, semáforo, mezcladora) o Trabajos anteriores: lo que había antes de abrir o limpiar se guarda solo en este navegador.'],
  [
    'Simulación',
    'Botón Simular. Etapa activa: verde con punto. Transición validada: ámbar; franqueable: verde. Acción emitida: verde. Entradas con interruptor, pulsador o teclas 1–9; «Paso» franquea de uno en uno para ver la evolución fugaz.',
  ],
  [
    'Paso a ladder',
    'Botón Ladder: una marca por etapa con SET/RESET (inicialización, condiciones de franqueo, desactivación, activación, temporizaciones, acciones memorizadas y salidas). Exporta el esquema (SVG, PNG, PDF) y el programa en texto estructurado (ST) y AWL de S7.',
  ],
  [
    'GEMMA',
    'Botón GEMMA de la barra: marca los estados que usas (A, F, D), sus transiciones y la orden de forzado de cada uno sobre el grafcet de producción (p. ej. D1: F/G1{}, A6: F/G1{INIT}). «Generar» crea el grafcet de conducción en la hoja GEMMA (marco GC). El grafcet de producción tiene que estar en un marco con su nombre (G1).',
  ],
  [
    'Hojas',
    'Pestañas abajo del lienzo: + añade una hoja, doble clic la renombra. Con varios elementos seleccionados, clic derecho > «Mover a…». Los enlaces entre hojas se dibujan como referencias («a la etapa 5 (Hoja 2)»). La simulación, el ladder y Verificar ven todas las hojas; al exportar a PDF se puede elegir «Todas las hojas».',
  ],
  [
    'Analógicas',
    'Una entrada comparada con números (Temperatura > 60) es analógica. En Variables se elige su señal (4–20 mA o 0–10 V) y su rango físico; la simulación usa un deslizador en esas unidades y el programa del autómata compara con el valor bruto ya calculado (p. ej. AIW0 > 21760).',
  ],
  [
    'Grafcets parciales y forzado',
    'Selecciona etapas y, con el botón derecho, «Encerrar en un grafcet parcial» (marco G1, G2...). Una acción F/G2{3} fuerza G2 a tener solo la etapa 3 activa mientras dure la etapa; F/G2{} lo vacía, F/G2{*} lo congela y F/G2{INIT} lo reinicia. El grafcet forzado no evoluciona.',
  ],
  [
    'Referencias de enlace',
    'Clic derecho sobre un enlace largo > «Cortar con referencias»: se dibuja como una flecha bajo el origen («a la etapa 0») y un tramo sobre el destino («de …»). Sigue siendo el mismo enlace para la simulación y el ladder.',
  ],
  [
    'Macroetapas',
    'Convierte una etapa en macroetapa (M1) y dibuja su expansión en un marco «M1» con una etapa de entrada E1 y una de salida S1. Activar M1 activa E1, y la transición siguiente a M1 solo se franquea con S1 activa.',
  ],
  [
    'Escenarios de prueba',
    'En la simulación, «Grabar escenario» anota los cambios de entradas con su instante; se guardan en el proyecto y se reproducen con un clic (a la velocidad elegida). El cronograma completo se exporta en SVG o CSV.',
  ],
  [
    'Variables de etapa',
    'X2 vale 1 con la etapa 2 activa (IEC 60848). En Variables puedes elegir que la tabla, el ladder, el ST, el AWL y la simulación usen E2; en las receptividades se sigue escribiendo X2 y 5s/X2.',
  ],
  ['Receptividades', '!a = a negada (raya encima) · ↑a / ↓a = flancos · a · b = Y · a + b = O · 5s/X2 = 5 s tras activarse la etapa 2.'],
]

// Ayuda rápida: atajos de teclado y resumen de la notación IEC 60848 que usa el editor.
export default function HelpDialog({ onClose }) {
  const dialogRef = useRef(null)
  useEffect(() => {
    if (!dialogRef.current.open) dialogRef.current.showModal()
  }, [])

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onClick={(e) => e.target === dialogRef.current && onClose()}
      aria-labelledby="help-title"
      className="m-auto w-[min(44rem,calc(100vw-2rem))] rounded-xl bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-900/40"
    >
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
        <h2 id="help-title" className="text-base font-semibold">
          Ayuda
        </h2>
        <button type="button" onClick={onClose} title="Cerrar (Esc)" className="rounded-md p-1 text-slate-500 hover:bg-slate-100">
          <X size={18} />
        </button>
      </div>
      <div className="grid max-h-[75vh] gap-6 overflow-y-auto px-5 py-4 md:grid-cols-2">
        <section>
          <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Atajos</h3>
          <dl className="space-y-1.5 text-sm">
            {SHORTCUTS.map(([keys, what]) => (
              <div key={keys} className="flex gap-3">
                <dt className="w-40 shrink-0 font-mono text-xs leading-5 text-slate-600">{keys}</dt>
                <dd>{what}</dd>
              </div>
            ))}
          </dl>
        </section>
        <section>
          <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Notación IEC 60848</h3>
          <dl className="space-y-2 text-sm">
            {NOTATION.map(([term, desc]) => (
              <div key={term}>
                <dt className="font-medium">{term}</dt>
                <dd className="text-slate-600">{desc}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
    </dialog>
  )
}
