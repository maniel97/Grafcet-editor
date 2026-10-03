// Colores del esquema eléctrico: tinta y conductores / embarrados según su potencial
// (IEC 60445 y 60204-1: fases marrón, negro y gris; neutro azul; tierra verde-amarillo; 24 V).
export const INK = '#0f172a'
export const POTENTIAL_COLORS = { L1: '#92400e', L2: '#111827', L3: '#6b7280', L: '#92400e', N: '#2563eb', PE: '#65a30d', 'L+': '#dc2626', M: '#1d4ed8' }
// Secundario de un transformador (circuito de mando a tensión reducida): naranja.
export const SECONDARY_COLOR = '#ea580c'
export const potentialColor = (p) => POTENTIAL_COLORS[p] ?? (String(p).startsWith('sec:') ? SECONDARY_COLOR : '#0f172a')
