// Atajos para contadores (panel de propiedades): poner a 0, sumar y restar uno en una etapa, y
// comparar en una receptividad. Al usarlos, el contador queda declarado en la tabla de variables.

export const isVariableName = (name) => /^[\p{L}_][\p{L}\p{N}_]*$/u.test(String(name ?? ''))

// Acciones de un contador: memorizadas al activar la etapa (ver ayuda «Contadores»).
export const counterActions = (name) => [
  { text: `${name}:=0`, kind: 'stored-on', title: 'reset' },
  { text: `${name}:=${name}+1`, kind: 'stored-on', title: 'up' },
  { text: `${name}:=${name}-1`, kind: 'stored-on', title: 'down' },
]

// Comparaciones de una receptividad: alcanza n / por debajo de n (excluyentes entre sí).
export const counterConditions = (name, n) => [
  { text: `[${name} >= ${n}]`, title: 'reached' },
  { text: `[${name} < ${n}]`, title: 'below' },
]

// Contadores que ya hay en el proyecto: declarados como contador o palabras que cuentan (C:=C+1).
export function counterNames(symbols, plcVariables = {}) {
  return [...symbols]
    .filter(([name, found]) => {
      const type = plcVariables[name]?.type ?? found.type
      return type === 'counter' || (type === 'memory' && found.numeric)
    })
    .map(([name]) => name)
}

// Declara `name` como contador si aún no tiene tipo en la tabla (no cambia uno ya elegido).
export function declareCounter(plc, name) {
  if (!isVariableName(name) || plc.variables?.[name]?.type) return plc
  return { ...plc, variables: { ...plc.variables, [name]: { ...plc.variables?.[name], type: 'counter', address: plc.variables?.[name]?.address ?? '' } } }
}
