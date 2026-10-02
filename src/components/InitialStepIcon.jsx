// Icono de etapa inicial: dos cuadrados concéntricos, como el símbolo de IEC 60848.
// Misma interfaz que los iconos de lucide-react (size, strokeWidth, className) para usarlo igual.
export default function InitialStepIcon({ size = 24, strokeWidth = 2, className = '', ...rest }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      {...rest}
    >
      <rect x="3" y="3" width="18" height="18" rx="1" />
      <rect x="7" y="7" width="10" height="10" rx="0.5" />
    </svg>
  )
}
