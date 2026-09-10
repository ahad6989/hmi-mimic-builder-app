import TopBar from './components/TopBar'
import ToolDock from './components/ToolDock'
import Canvas from './components/Canvas'
import Inspector from './components/Inspector'
import StatusBar from './components/StatusBar'

function App() {
  return (
    <div className="h-screen flex flex-col">
      <TopBar />

      <div className="flex flex-1 overflow-hidden">
        <ToolDock />

        <Canvas />

        <Inspector />
      </div>

      <StatusBar />
    </div>
  )
}

export default App