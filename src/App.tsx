import { useState } from 'react'
import TopBar from './components/TopBar'
import ToolDock from './components/ToolDock'
import Canvas from './components/Canvas'
import Inspector from './components/Inspector'
import StatusBar from './components/StatusBar'

function App() {
  const [isDarkMode, setIsDarkMode] = useState(false)

  return (
    <div className={isDarkMode ? 'dark h-screen flex flex-col' : 'h-screen flex flex-col'}>
      <TopBar
        isDarkMode={isDarkMode}
        onToggleTheme={() => setIsDarkMode((current) => !current)}
      />

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
