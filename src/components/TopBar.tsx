function TopBar() {
  return (
    <header className="h-14 border-b bg-white flex items-center px-4">
      <h1 className="font-bold text-lg">VectorCraft Studio</h1>

      <div className="ml-8 flex gap-4 text-sm">
        <button>File</button>
        <button>Edit</button>
        <button>Zoom</button>
        <button>Export</button>
        <button>History</button>
      </div>
    </header>
  )
}

export default TopBar