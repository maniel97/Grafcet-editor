import { ReactFlowProvider } from '@xyflow/react'
import GrafcetCanvas from './components/GrafcetCanvas'

export default function App() {
  return (
    <ReactFlowProvider>
      <GrafcetCanvas />
    </ReactFlowProvider>
  )
}
