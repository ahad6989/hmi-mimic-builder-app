function StatusBar() {
  return (
    <footer className="h-8 border-t bg-white px-4 flex items-center text-xs text-gray-500">
      X: 0 &nbsp;&nbsp; Y: 0
      <span className="ml-auto">Zoom: 100%</span>
    </footer>
  )
}

export default StatusBar