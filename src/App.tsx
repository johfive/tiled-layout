import { useCallback, useEffect, useState } from 'react'
import { useLayoutStore } from './stores/layoutStore'
import Toolbar from './components/Toolbar'
import PageList from './components/PageList'
import GridEditor from './components/GridEditor'

function App() {
  const [isDraggingOver, setIsDraggingOver] = useState(false)
  const { addFilesToCells, clearSelectedCell } = useLayoutStore()

  const handleGlobalDragOver = useCallback((e: DragEvent) => {
    e.preventDefault()
    if (e.dataTransfer?.types.includes('Files')) {
      setIsDraggingOver(true)
    }
  }, [])

  const handleGlobalDragLeave = useCallback((e: DragEvent) => {
    if (e.relatedTarget === null) {
      setIsDraggingOver(false)
    }
  }, [])

  const handleGlobalDrop = useCallback(async (e: DragEvent) => {
    e.preventDefault()
    setIsDraggingOver(false)

    const files = e.dataTransfer?.files
    if (!files || files.length === 0) return

    const supportedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp', 'image/svg+xml']
    const imageFiles: { imageData: string; filename: string; originalPath: string }[] = []

    for (const file of Array.from(files)) {
      if (supportedTypes.includes(file.type) || file.name.endsWith('.svg')) {
        const reader = new FileReader()
        const imageData = await new Promise<string>((resolve) => {
          reader.onload = () => resolve(reader.result as string)
          reader.readAsDataURL(file)
        })

        imageFiles.push({
          imageData,
          filename: file.name,
          originalPath: (file as any).path || file.name
        })
      }
    }

    if (imageFiles.length > 0) {
      addFilesToCells(imageFiles)
    }
  }, [addFilesToCells])

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Delete' || e.key === 'Backspace') {
      clearSelectedCell()
    }
  }, [clearSelectedCell])

  useEffect(() => {
    document.addEventListener('dragover', handleGlobalDragOver)
    document.addEventListener('dragleave', handleGlobalDragLeave)
    document.addEventListener('drop', handleGlobalDrop)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('dragover', handleGlobalDragOver)
      document.removeEventListener('dragleave', handleGlobalDragLeave)
      document.removeEventListener('drop', handleGlobalDrop)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [handleGlobalDragOver, handleGlobalDragLeave, handleGlobalDrop, handleKeyDown])

  return (
    <>
      <Toolbar />
      <div className="flex-1 flex overflow-hidden">
        <PageList />
        <GridEditor />
      </div>
      {isDraggingOver && (
        <div className="drop-zone-overlay">
          <span className="bg-primary text-primary-content px-8 py-4 rounded-lg text-lg font-medium">
            Drop images to add to layout
          </span>
        </div>
      )}
    </>
  )
}

export default App
