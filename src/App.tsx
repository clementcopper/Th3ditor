import { registerAllNodes } from './graph-engine/register-all'
import { EditorLayout } from './components/editor/EditorLayout'

// Register all node definitions before rendering
registerAllNodes()

function App() {
  return <EditorLayout />
}

export default App
