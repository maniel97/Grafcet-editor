// Logo de Grafcet Editor: la etapa inicial (doble cuadrado, IEC 60848) activa (punto verde, como en
// la simulación). El dibujo va en el color del texto, así que vale en modo claro y oscuro. El mismo
// dibujo, sobre baldosa blanca, es el icono de la app (public/icon.svg).
export default function Logo({ size = 24, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" className={className} aria-hidden="true" focusable="false">
      <g fill="none" stroke="currentColor" strokeLinecap="square">
        <rect x="5" y="5" width="38" height="38" strokeWidth="3" />
        <rect x="11" y="11" width="26" height="26" strokeWidth="2" />
      </g>
      <circle cx="24" cy="24" r="6" fill="#16a34a" />
    </svg>
  )
}
