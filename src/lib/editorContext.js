import { createContext, useContext } from 'react'

// Acciones del editor accesibles desde componentes anidados (nodos, botones flotantes).
const EditorContext = createContext({ takeSnapshot: () => {}, startLoop: () => {}, setPreview: () => {} })

export const EditorProvider = EditorContext.Provider
export const useEditor = () => useContext(EditorContext)
