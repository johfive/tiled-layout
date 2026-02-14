import { useLayoutStore } from '../stores/layoutStore'
import { BUILD_NUMBER } from '../buildInfo'

export default function ZoomBar() {
  const { zoom, setZoom } = useLayoutStore()

  return (
    <div className="zoom-bar">
      <button onClick={() => setZoom(zoom - 0.25)} title="Zoom out">−</button>
      <span className="zoom-bar-label">{Math.round(zoom * 100)}%</span>
      <button onClick={() => setZoom(zoom + 0.25)} title="Zoom in">+</button>
      <button onClick={() => setZoom(1)} title="Reset zoom (⌘0)">⌘0</button>
      <span className="zoom-bar-build">Build #{BUILD_NUMBER}</span>
    </div>
  )
}
