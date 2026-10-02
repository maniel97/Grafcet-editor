import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Maximize2, Minus, Plus } from "lucide-react";

// Niveles de zoom de los botones − / +.
const STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3, 4];
// Al ajustar al ancho no se pasa de aquí: el texto del esquema queda como el de la interfaz
// (un esquema estrecho en una pantalla ancha no se hace gigante).
const MAX_FIT = 1.5;

// Visor del esquema ladder: por defecto se ajusta al ancho disponible y se centra (en pantallas
// grandes se ve grande); con − / + o Ctrl + rueda se amplía, y el SVG sigue nítido porque se
// escala como vector. El tamaño de exportación no cambia (atributos width/height del SVG).
export default function LadderZoom({ naturalWidth, children }) {
  const scrollRef = useRef(null);
  const [available, setAvailable] = useState(0);
  const [zoom, setZoom] = useState("fit"); // 'fit' o un factor

  useLayoutEffect(() => {
    const el = scrollRef.current;
    const measure = () => setAvailable(el.clientWidth - 32); // menos el relleno
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const fit =
    naturalWidth && available > 0
      ? Math.min(MAX_FIT, available / naturalWidth)
      : 1;
  const scale = zoom === "fit" ? fit : zoom;
  const stepTo = (dir) =>
    setZoom(() => {
      const next =
        dir > 0
          ? STEPS.find((s) => s > scale + 0.01)
          : [...STEPS].reverse().find((s) => s < scale - 0.01);
      return next ?? scale;
    });

  // Ctrl + rueda: zoom (el navegador ampliaría toda la página).
  useEffect(() => {
    const el = scrollRef.current;
    const onWheel = (e) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      stepTo(e.deltaY < 0 ? 1 : -1);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  });

  const button =
    "rounded p-1 text-slate-600 hover:bg-slate-100 disabled:opacity-30";
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Franja propia para el zoom: no tapa el esquema. */}
      <div className="flex justify-end px-4 pt-2">
        <div
          className="flex items-center gap-0.5 rounded-md border border-slate-200 bg-white p-0.5 text-xs shadow-sm"
          role="group"
          aria-label="Zoom del esquema"
        >
          <button
            type="button"
            className={button}
            onClick={() => stepTo(-1)}
            disabled={scale <= STEPS[0] + 0.01}
            aria-label="Alejar el esquema"
            title="Alejar (Ctrl + rueda)"
          >
            <Minus size={14} />
          </button>
          <button
            type="button"
            onClick={() => setZoom("fit")}
            className={`min-w-14 rounded px-1.5 py-1 tabular-nums hover:bg-slate-100 ${zoom === "fit" ? "font-semibold text-blue-700" : "text-slate-700"}`}
            title="Ajustar al ancho"
            aria-label="Ajustar al ancho"
            data-zoom={scale.toFixed(2)}
          >
            {Math.round(scale * 100)} %
          </button>
          <button
            type="button"
            className={button}
            onClick={() => stepTo(1)}
            disabled={scale >= STEPS.at(-1) - 0.01}
            aria-label="Acercar el esquema"
            title="Acercar (Ctrl + rueda)"
          >
            <Plus size={14} />
          </button>
          <button
            type="button"
            className={button}
            onClick={() => setZoom("fit")}
            aria-label="Ajustar el esquema al ancho"
            title="Ajustar al ancho"
          >
            <Maximize2 size={14} />
          </button>
        </div>
      </div>
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-auto p-4 pt-2">
        <div
          className="paper ladder-zoom mx-auto rounded-lg border border-slate-200 bg-white shadow-sm"
          style={{ width: naturalWidth * scale + 2 }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
