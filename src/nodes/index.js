import StepNode from './StepNode'
import TransitionNode from './TransitionNode'
import VariablesTableNode from './VariablesTableNode'

export const nodeTypes = {
  step: StepNode,
  transition: TransitionNode,
  variables: VariablesTableNode,
}

// La tabla de variables del lienzo es única y tiene id fijo.
export const VARIABLES_TABLE_ID = 'variables-table'
