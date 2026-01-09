import { useCallback, useEffect } from 'react'
import { useLayoutStore } from './stores/layoutStore'
import Toolbar from './components/Toolbar'
import PageList from './components/PageList'
import GridEditor from './components/GridEditor'

function App() {
  const { addFilesToCells, clearSelectedCell } = useLayoutStore()

  const handleGlobalDragOver = useCallback((e: DragEvent) => {
    e.preventDefault()
  }, [])

  const handleGlobalDrop = useCallback(async (e: DragEvent) => {
    e.preventDefault()

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
    document.addEventListener('drop', handleGlobalDrop)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('dragover', handleGlobalDragOver)
      document.removeEventListener('drop', handleGlobalDrop)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [handleGlobalDragOver, handleGlobalDrop, handleKeyDown])

  return (
    <>
      <Toolbar />
      <div className="main-content">
        <PageList />
        <GridEditor />
      </div>
    </>
  )
}

export default App
