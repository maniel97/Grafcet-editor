import StepNode from './StepNode'
import TransitionNode from './TransitionNode'
import VariablesTableNode from './VariablesTableNode'
import NoteNode from './NoteNode'
import FrameNode from './FrameNode'

export const nodeTypes = {
  step: StepNode,
  transition: TransitionNode,
  variables: VariablesTableNode,
  note: NoteNode,
  frame: FrameNode,
}

// La tabla de variables del lienzo es única y tiene id fijo.
export const VARIABLES_TABLE_ID = 'variables-table'
