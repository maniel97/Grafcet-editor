import { useEffect, useMemo, useRef, useState } from 'react'
import { BookOpen, ChevronRight, Compass, Home, Info, Keyboard, Search, Shapes, X } from 'lucide-react'
import { AUTHOR, ISSUES_URL, LICENSE_NAME, LICENSE_URL, PRERELEASE, REPO_URL, SITE_URL, VERSION, YEAR } from '../lib/about'
import { SHORTCUTS } from '../lib/shortcuts'
import { N_, t } from '../lib/i18n'
import Markdown from '../help/Markdown'
import { ARTICLES, SECTIONS, articleSource, articleTitle } from '../help'
import { EXAMPLES } from '../lib/examples'
import { tutorialById } from '../lib/tutorials'

const NOTATION = [
  [N_('Etapa inicial'), N_('Doble cuadrado. Activa al arrancar; debe haber al menos una.'),],
  [N_('Macroetapa'), N_('Cuadrado con trazos arriba y abajo (M1…). Se detalla en otro grafcet.'),],
  [N_('Transición'), N_('Trazo horizontal con su receptividad a la derecha. Usa 1 si siempre se cumple.'),],
  [N_('Divergencia en O'), N_('Una etapa con varias transiciones alternativas: línea simple bajo la etapa.'),],
  [N_('Divergencia en Y'), N_('Una transición que activa varias etapas a la vez: doble línea.'),],
  [N_('Bucle'), N_('Enlace hacia arriba: por la izquierda y con flecha (los enlaces se leen de arriba abajo).'),],
  [N_('Acción continua'), N_('Caja simple: activa mientras la etapa está activa.'),],
  [N_('Acción condicionada'), N_('Trazo vertical encima con la condición. Con tiempo (3s/X2) es retardada.'),],
  [N_('Acción memorizada'), N_('Flecha ↑ (al activarse la etapa) o ↓ (al desactivarse), p. ej. A:=1.'),],
  [N_('Acción al evento'), N_('Flecha y evento encima, p. ej. ↑b.'),],
  [
    N_('Tabla de variables en el lienzo'),
    N_('Clic en una dirección o comentario para editarlo; arrastra una variable a otra sección para cambiar su tipo; al pasar por una fila se resaltan los nodos que la usan.'),
  ],
  [
    N_('Notas'),
    N_('Cuadros de texto libres (barra o clic derecho en el lienzo). No forman parte del grafcet: la verificación, la simulación y el ladder las ignoran. Formato: «# Título», «- elemento» para listas, **negrita** entre dobles asteriscos y `Variable` entre comillas invertidas.'),
  ],
  [N_('Ordenar'), N_('Selecciona varios nodos y, con clic derecho: Alinear en columna o Espaciar la secuencia (distancias estándar).'),],
  [N_('Abrir'), N_('Archivo .json, Ejemplos (ordenados por niveles, del 1 al 5) o Trabajos anteriores: lo que había antes de abrir o limpiar se guarda solo en este navegador.')],
  [
    N_('Simulación'),
    N_('Botón Simular. Etapa activa: verde con punto. Transición validada: ámbar; franqueable: verde. Acción emitida: verde. Entradas con interruptor, pulsador o teclas 1–9; «Paso» franquea de uno en uno para ver la evolución fugaz.'),
  ],
  [
    N_('Paso a ladder'),
    N_('Botón Ladder: una marca por etapa con SET/RESET (inicialización, condiciones de franqueo, desactivación, activación, temporizaciones, acciones memorizadas y salidas). Exporta el esquema (SVG, PNG, PDF) y el programa en texto estructurado (ST) y AWL de S7.'),
  ],
  [
    N_('GEMMA'),
    N_('Botón GEMMA de la barra: marca los estados que usas (A, F, D), sus transiciones y la orden de forzado de cada uno sobre el grafcet de producción (p. ej. D1: F/G1{}, A6: F/G1{INIT}). «Generar» crea el grafcet de conducción en la hoja GEMMA (marco GC). El grafcet de producción tiene que estar en un marco con su nombre (G1).'),
  ],
  [
    N_('Hojas'),
    N_('Pestañas abajo del lienzo: + añade una hoja, doble clic la renombra. Con varios elementos seleccionados, clic derecho > «Mover a…». Los enlaces entre hojas se dibujan como referencias («a la etapa 5 (Hoja 2)»). La simulación, el ladder y Verificar ven todas las hojas; al exportar a PDF se puede elegir «Todas las hojas».'),
  ],
  [
    N_('Analógicas'),
    N_('Una entrada comparada con números (Temperatura > 60) es analógica. En Variables se elige su señal (4–20 mA o 0–10 V) y su rango físico; la simulación usa un deslizador en esas unidades. En el programa del autómata, las comparaciones con números se hacen con el valor bruto ya calculado (p. ej. AIW0 > 21760); comparar dos analógicas (Peso >= Consigna) o calcular con ellas (Velocidad := Consigna / 2) se escala en el autómata, en REAL.'),
  ],
  [
    N_('Grafcets parciales y forzado'),
    N_('Selecciona etapas y, con el botón derecho, «Encerrar en un grafcet parcial» (marco G1, G2...). Una acción F/G2{3} fuerza G2 a tener solo la etapa 3 activa mientras dure la etapa; F/G2{} lo vacía, F/G2{*} lo congela y F/G2{INIT} lo reinicia. El grafcet forzado no evoluciona.'),
  ],
  [
    N_('Referencias de enlace'),
    N_('Clic derecho sobre un enlace largo > «Cortar con referencias»: se dibuja como una flecha bajo el origen («a la etapa 0») y un tramo sobre el destino («de …»). Sigue siendo el mismo enlace para la simulación y el ladder.'),
  ],
  [
    N_('Macroetapas'),
    N_('Convierte una etapa en macroetapa (M1) y dibuja su expansión en un marco «M1» con una etapa de entrada E1 y una de salida S1. Activar M1 activa E1, y la transición siguiente a M1 solo se franquea con S1 activa.'),
  ],
  [
    N_('Escenarios de prueba'),
    N_('En la simulación, «Grabar escenario» anota los cambios de entradas con su instante; se guardan en el proyecto y se reproducen con un clic (a la velocidad elegida). El cronograma completo se exporta en SVG o CSV.'),
  ],
  [
    N_('Variables de etapa'),
    N_('X2 vale 1 con la etapa 2 activa (IEC 60848). En Variables puedes elegir que la tabla, el ladder, el ST, el AWL y la simulación usen E2; en las receptividades se sigue escribiendo X2 y 5s/X2.'),
  ],
  [N_('Receptividades'), N_('!a = a negada (raya encima) · ↑a / ↓a = flancos · a · b = Y · a + b = O · 5s/X2 = 5 s tras activarse la etapa 2 · 3s/a = a lleva 3 s a 1 · 3s/a/2s = sube 3 s después de a y baja 2 s después de que a baje · [C >= 3] = condición numérica.')],
  [N_('Encapsulación'), N_('Una etapa encapsulante (esquinas cortadas) tiene su grafcet encapsulado en un marco: al activarse, se activan las etapas con enlace de activación (*); al desactivarse, todo lo encapsulado. Clic derecho en una etapa > Convertir en etapa encapsulante.')],
  [N_('Transiciones fuente y sumidero'), N_('Una transición sin etapa anterior (fuente) está siempre validada: cada vez que se cumple su receptividad, normalmente un flanco (↑Pieza), activa las etapas siguientes. Una transición sin etapa posterior (sumidero) desactiva sus etapas anteriores.')],
]

// Preguntas frecuentes (inicio de la ayuda): lo que más se pregunta al empezar.
const FAQ = [
  [N_('¿Cómo enlazo una etapa con una transición?'), N_('Arrastra desde el punto de abajo de la etapa hasta la transición, o selecciona la etapa y pulsa su +: añade la transición debajo, ya enlazada. Etapas y transiciones se alternan siempre.')],
  [N_('¿Cómo hago que el grafcet vuelva a empezar (un bucle)?'), N_('Clic derecho en la última transición > «Bucle a etapa» y pulsa la etapa de destino. El enlace sube por la izquierda con una flecha, como manda la norma.')],
  [N_('¿Cómo hago caminos alternativos (O) o simultáneos (Y)?'), N_('O: clic derecho en la transición > «Añadir alternativa en O»; cada camino lleva su receptividad y deben ser excluyentes (Verificar lo comprueba). Y: clic derecho en la transición > «Divergencia en Y (2 ramas)»; para juntar las ramas, selecciona sus últimas etapas y, con clic derecho, «Converger en Y».')],
  [N_('¿Qué escribo en una receptividad?'), N_('Variables y operadores de la norma: a · b (Y), a + b (O), !a (negación), ↑a / ↓a (flancos), X2 (etapa 2 activa), 5s/X2 (temporización), [C >= 3] (comparación). Al escribir, el autocompletado propone las variables que ya existen.')],
  [N_('¿Qué tipos de acción hay?'), N_('Continua (mientras la etapa está activa), condicionada (con una condición encima), memorizada al activarse o al desactivarse la etapa (A:=1, C:=C+1) y al evento (↑b). Se eligen en las propiedades de la etapa (doble clic).')],
  [N_('¿Por qué Verificar marca un error o un aviso?'), N_('Cada mensaje explica la regla de la norma que no se cumple y qué hacer; púlsalo para ir al elemento. Los errores impiden que el grafcet sea conforme; los avisos señalan algo que probablemente no quieres; los consejos, errores típicos al aprender.')],
  [N_('¿Cómo pruebo el grafcet sin autómata?'), N_('Pulsa Simular: activa las entradas con un clic o con las teclas 1–9 y mira las etapas activas. Si algo no avanza, pasa el ratón por la transición. En los ejemplos con planta virtual, la máquina se mueve con tus salidas.')],
  [N_('¿Cómo doy direcciones del autómata a las variables?'), N_('Abre la tabla de variables y pulsa «Rellenar vacías»: asigna direcciones según el formato elegido (S7-200, S7-300/1200 o IEC 61131-3). Puedes cambiar cualquiera a mano.')],
  [N_('¿Cómo paso el programa al autómata?'), N_('Botón Ladder: ladder, ST, SCL (TIA Portal) y AWL/STL. Para el S7-200, descarga el .awl y, en Micro/WIN, Archivo > Importar; la tabla de símbolos se copia y se pega.')],
  [N_('¿Dónde se guarda mi trabajo?'), N_('Mientras trabajas se guarda solo en este navegador, y lo anterior queda en Abrir > Trabajos anteriores. Para llevártelo, «Guardar» descarga un archivo .json; también puedes compartirlo por enlace (Exportar > Compartir por enlace).')],
  [N_('¿Cómo cambio el nombre de una variable en todo el diagrama?'), N_('En la tabla de variables (la del lienzo o la del diálogo), clic en su nombre y escribe el nuevo: cambia en receptividades, acciones, la planta y el esquema, y conserva su dirección y su comentario.')],
  [N_('¿Cómo cambio el idioma, el tema o el tamaño de letra?'), N_('Botón Opciones (el engranaje de la barra).')],
]

// Páginas fijas de la ayuda (los artículos de la wiki se añaden aquí).
const PAGES = [
  { id: 'inicio', title: N_('Inicio'), icon: Home },
  { id: 'atajos', title: N_('Atajos de teclado'), icon: Keyboard },
  { id: 'notacion', title: N_('Notación IEC 60848'), icon: Shapes },
  { id: 'acerca', title: N_('Acerca de'), icon: Info },
]

// Acerca de: autoría, licencia (software libre), cómo se ha hecho (con IA, supervisado),
// privacidad y marcas citadas.
const link = 'text-blue-700 underline hover:text-blue-900'
function About() {
  const build = import.meta.env.BUILD_ID ? new Date(parseInt(import.meta.env.BUILD_ID, 36)).toISOString().slice(0, 10) : ''
  return (
    <section className="max-w-2xl space-y-4" data-about="">
      <div>
        <h3 className="text-lg font-semibold">Grafcet Editor</h3>
        <p className="text-slate-600">
          {t('Editor y simulador de grafcet (IEC 60848) para la enseñanza de automatismos.')}
        </p>
        <p className="text-slate-600" data-version={VERSION}>
          {t('Versión {version}', { version: VERSION })}
          {build && ` · ${t('compilación del {fecha}', { fecha: build })}`}
        </p>
        <p className="mt-1">
          <a href={SITE_URL} className={link} target="_blank" rel="noreferrer">
            {SITE_URL.replace('https://', '')}
          </a>
          {REPO_URL && (
            <>
              {' · '}
              <a href={REPO_URL} className={link} target="_blank" rel="noreferrer">
                {t('Código fuente')}
              </a>
            </>
          )}
        </p>
      </div>
      {PRERELEASE && (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2" data-prerelease={PRERELEASE}>
          <h4 className="font-semibold text-amber-900">{PRERELEASE === 'alpha' ? t('Estado: alfa (en pruebas)') : t('Estado: beta (en pruebas)')}</h4>
          <p className="text-amber-900">
            {t('Es una versión de prueba: puede tener fallos y algunas cosas pueden cambiar. Descarga tus proyectos (Guardar, archivo .json) en vez de fiarte solo de lo que guarda el navegador.')}{' '}
            {REPO_URL && (
              <a href={ISSUES_URL} className={link} target="_blank" rel="noreferrer">
                {t('Avisar de un fallo')}
              </a>
            )}
          </p>
        </div>
      )}
      <div>
        <h4 className="font-semibold">{t('Software libre')}</h4>
        <p className="text-slate-600">
          {t('© {año} {autor}. Licencia {licencia}: puedes usarlo, copiarlo, estudiarlo y modificarlo gratis; las versiones modificadas que se publiquen deben seguir siendo libres.', { año: YEAR, autor: AUTHOR, licencia: LICENSE_NAME })}{' '}
          <a href={LICENSE_URL} className={link} target="_blank" rel="noreferrer">
            {t('Texto de la licencia')}
          </a>
        </p>
      </div>
      <div>
        <h4 className="font-semibold">{t('Cómo se ha hecho')}</h4>
        <p className="text-slate-600">
          {t('Desarrollado con asistencia de inteligencia artificial (Claude, de Anthropic) mediante «vibe coding»: la IA escribe el código bajo la dirección, la revisión y las pruebas de {autor}. Más de mil pruebas automáticas comprueban su funcionamiento.', { autor: AUTHOR })}
        </p>
      </div>
      <div>
        <h4 className="font-semibold">{t('Privacidad')}</h4>
        <p className="text-slate-600">{t('Todo funciona en tu navegador: tus proyectos no se envían a ningún servidor. Se guardan en este equipo o en los archivos que descargues; un enlace para compartir lleva el proyecto dentro del propio enlace.')}</p>
      </div>
      <div>
        <h4 className="font-semibold">{t('Sin garantía')}</h4>
        <p className="text-slate-600">{t('Es una herramienta educativa: no está certificada para programar máquinas reales. Revisa siempre el programa antes de cargarlo en un autómata.')}</p>
      </div>
      <div>
        <h4 className="font-semibold">{t('Marcas y normas')}</h4>
        <p className="text-slate-600">
          {t('Siemens, SIMATIC, STEP 7-Micro/WIN y TIA Portal son marcas de Siemens AG; este proyecto no tiene relación con Siemens. Las normas IEC 60848, IEC 60617, IEC 61131-3 e ISO 1219 se citan como referencia; los símbolos están dibujados para este proyecto.')}
        </p>
      </div>
    </section>
  )
}

// Sin tildes ni mayúsculas, para buscar.
const plain = (text) =>
  String(text)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')

// Centro de ayuda: inicio (visita guiada y preguntas frecuentes), atajos, notación y, después, la
// wiki. Buscador en todo lo escrito (en el idioma elegido).
// page: 'inicio' | 'atajos' | 'notacion' | 'acerca' | 'a:<id de artículo>'.
export default function HelpDialog({ onClose, onTour, onExample, onTutorial, initialPage = 'inicio' }) {
  const dialogRef = useRef(null)
  const [page, setPage] = useState(initialPage)
  const [query, setQuery] = useState('')
  const [openFaq, setOpenFaq] = useState(null)
  useEffect(() => {
    if (!dialogRef.current.open) dialogRef.current.showModal()
  }, [])

  // Todo lo que se puede buscar: [página, título, texto, índice de la pregunta].
  const entries = useMemo(
    () => [
      ...FAQ.map(([q, a], i) => ['inicio', t(q), t(a), i]),
      ...SHORTCUTS.map(([keys, what]) => ['atajos', t(keys), t(what)]),
      ...NOTATION.map(([term, desc]) => ['notacion', t(term), t(desc)]),
      ...ARTICLES.map((id) => [`a:${id}`, articleTitle(id), articleSource(id).replace(/^#.*$/m, '').replace(/[#*`>[\]()]/g, ' ')]),
    ],
    [],
  )
  const words = plain(query).split(/\s+/).filter(Boolean)
  const results = words.length ? entries.filter(([, title, text]) => words.every((w) => plain(`${title} ${text}`).includes(w))) : null

  const go = (id, faq = null) => {
    setPage(id)
    setQuery('')
    setOpenFaq(faq)
  }

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onClick={(e) => e.target === dialogRef.current && onClose()}
      aria-labelledby="help-title"
      className="m-auto h-[min(48rem,calc(100vh-2rem))] w-[min(64rem,calc(100vw-2rem))] overflow-hidden rounded-xl bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-900/40"
    >
      <div className="flex h-full flex-col">
        <div className="flex items-center gap-3 border-b border-slate-200 px-5 py-3">
          <h2 id="help-title" className="flex items-center gap-2 text-base font-semibold">
            <BookOpen size={18} /> {t('Ayuda')}
          </h2>
          <label className="relative ml-4 flex-1">
            <Search size={14} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('Buscar en la ayuda…')}
              aria-label={t('Buscar en la ayuda')}
              className="w-full max-w-md rounded-md border border-slate-300 py-1 pl-7 pr-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </label>
          {onTour && (
            <button
              type="button"
              onClick={onTour}
              className="flex shrink-0 items-center gap-1.5 rounded-md border border-blue-200 bg-blue-50 px-3 py-1 text-sm text-blue-800 hover:bg-blue-100"
            >
              <Compass size={16} /> {t('Visita guiada')}
            </button>
          )}
          <button type="button" onClick={onClose} title={t('Cerrar (Esc)')} className="rounded-md p-1 text-slate-500 hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>
        <div className="flex min-h-0 flex-1">
          <nav aria-label={t('Secciones de la ayuda')} className="w-56 shrink-0 overflow-y-auto border-r border-slate-200 bg-slate-50 p-2 text-sm max-sm:hidden">
            {PAGES.map(({ id, title, icon: Icon }) => (
              <button
                key={id}
                type="button"
                aria-current={page === id && !results ? 'page' : undefined}
                onClick={() => go(id)}
                className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left ${page === id && !results ? 'bg-blue-100 text-blue-900' : 'text-slate-700 hover:bg-slate-200'}`}
              >
                <Icon size={15} className="shrink-0" /> {t(title)}
              </button>
            ))}
            {SECTIONS.map((section) => {
              const ids = section.articles.filter((id) => ARTICLES.includes(id))
              if (!ids.length) return null
              return (
                <div key={section.title} className="mt-3">
                  <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600">{t(section.title)}</p>
                  {ids.map((id) => (
                    <button
                      key={id}
                      type="button"
                      aria-current={page === `a:${id}` && !results ? 'page' : undefined}
                      onClick={() => go(`a:${id}`)}
                      className={`block w-full rounded-md px-2 py-1 text-left ${page === `a:${id}` && !results ? 'bg-blue-100 text-blue-900' : 'text-slate-700 hover:bg-slate-200'}`}
                    >
                      {articleTitle(id)}
                    </button>
                  ))}
                </div>
              )
            })}
          </nav>
          <main className="min-w-0 flex-1 overflow-y-auto px-6 py-5 text-sm leading-relaxed">
            {/* En pantallas estrechas no cabe el índice: un desplegable. */}
            <select
              aria-label={t('Secciones de la ayuda')}
              value={page}
              onChange={(e) => go(e.target.value)}
              className="mb-4 w-full rounded-md border border-slate-300 px-2 py-1 sm:hidden"
            >
              {PAGES.map(({ id, title }) => (
                <option key={id} value={id}>
                  {t(title)}
                </option>
              ))}
              {SECTIONS.map((section) => (
                <optgroup key={section.title} label={t(section.title)}>
                  {section.articles
                    .filter((id) => ARTICLES.includes(id))
                    .map((id) => (
                      <option key={id} value={`a:${id}`}>
                        {articleTitle(id)}
                      </option>
                    ))}
                </optgroup>
              ))}
            </select>
            {results ? (
              <section aria-label={t('Resultados de la búsqueda')}>
                <h3 className="mb-3 text-base font-semibold">{t('{n} resultados', { n: results.length })}</h3>
                {results.length === 0 && <p className="text-slate-500">{t('Nada coincide. Prueba con otras palabras.')}</p>}
                <ul className="space-y-2">
                  {results.map(([id, title, text, faq], i) => (
                    <li key={i}>
                      <button type="button" onClick={() => go(id, faq ?? null)} className="w-full rounded-md border border-slate-200 p-2 text-left hover:border-blue-300 hover:bg-blue-50">
                        <span className="block font-medium">{title}</span>
                        <span className="line-clamp-2 text-slate-600">{text}</span>
                        <span className="mt-0.5 block text-xs text-slate-400">{id.startsWith('a:') ? t('Wiki') : t(PAGES.find((p) => p.id === id)?.title ?? '')}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ) : page.startsWith('a:') ? (
              <article>
                <Markdown
                  source={articleSource(page.slice(2)) ?? ''}
                  ctx={{
                    onArticle: (id) => go(`a:${id}`),
                    example: (id) => EXAMPLES.find((ex) => ex.id === id),
                    tutorial: tutorialById,
                    onExample,
                    onTutorial,
                  }}
                />
              </article>
            ) : page === 'inicio' ? (
              <section>
                <h3 className="mb-1 text-lg font-semibold">{t('¿Por dónde empiezo?')}</h3>
                <p className="mb-3 text-slate-600">
                  {t('La visita guiada enseña lo principal en un par de minutos. Después, abre un ejemplo (Abrir > Ejemplos): están ordenados por niveles y cada uno trae una nota con lo que enseña.')}
                </p>
                {onTour && (
                  <button type="button" onClick={onTour} className="mb-6 flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700">
                    <Compass size={16} /> {t('Hacer la visita guiada')}
                  </button>
                )}
                <h3 className="mb-2 text-lg font-semibold">{t('Preguntas frecuentes')}</h3>
                <p className="mb-2 text-slate-600">{t('Y en la wiki (en el índice), cada parte del programa con su porqué y su cómo, ejemplos que se abren en el editor y tutoriales guiados.')}</p>
                <ul className="divide-y divide-slate-200 rounded-md border border-slate-200">
                  {FAQ.map(([q, a], i) => (
                    <li key={q}>
                      <button
                        type="button"
                        aria-expanded={openFaq === i}
                        onClick={() => setOpenFaq(openFaq === i ? null : i)}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left font-medium hover:bg-slate-50"
                      >
                        <ChevronRight size={15} className={`shrink-0 transition-transform ${openFaq === i ? 'rotate-90' : ''}`} />
                        {t(q)}
                      </button>
                      {openFaq === i && <p className="px-9 pb-3 text-slate-600">{t(a)}</p>}
                    </li>
                  ))}
                </ul>
              </section>
            ) : page === 'atajos' ? (
              <section>
                <h3 className="mb-3 text-lg font-semibold">{t('Atajos de teclado')}</h3>
                <dl className="space-y-1.5">
                  {SHORTCUTS.map(([keys, what]) => (
                    <div key={keys} className="flex gap-3">
                      <dt className="w-48 shrink-0 font-mono text-xs leading-5 text-slate-600">{t(keys)}</dt>
                      <dd>{t(what)}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            ) : page === 'acerca' ? (
              <About />
            ) : (
              <section>
                <h3 className="mb-3 text-lg font-semibold">{t('Notación IEC 60848')}</h3>
                <dl className="space-y-3">
                  {NOTATION.map(([term, desc]) => (
                    <div key={term}>
                      <dt className="font-medium">{t(term)}</dt>
                      <dd className="text-slate-600">{t(desc)}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            )}
          </main>
        </div>
      </div>
    </dialog>
  )
}
