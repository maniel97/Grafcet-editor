import { parseCondition } from '../lib/condition'

// Receptividad con los términos negados ("!x") dibujados con raya encima.
export default function ConditionText({ text, className }) {
  const segments = parseCondition(text).map((seg, i) =>
    seg.negated ? (
      <span key={i} className="overline decoration-1">
        {seg.text}
      </span>
    ) : (
      <span key={i}>{seg.text}</span>
    ),
  )
  return className ? <span className={className}>{segments}</span> : segments
}
