import { useCallback, useEffect } from 'react'
import { useLayoutStore } from './stores/layoutStore'
import Toolbar from './components/Toolbar'
import PageList from './components/PageList'
import GridEditor from './components/GridEditor'
import Toast from './components/Toast'

function App() {
  const { addFilesToCells, clearSelectedCell, loadLayoutData, showToast, toasts, removeToast } = useLayoutStore()

  const handleGlobalDragOver = useCallback((e: DragEvent) => {
    e.preventDefault()
  }, [])

  const handleGlobalDrop = useCallback(async (e: DragEvent) => {
    e.preventDefault()

    const files = e.dataTransfer?.files
    if (!files || files.length === 0) return

    // Check for JSON layout file
    for (const file of Array.from(files)) {
      if (file.name.endsWith('.json')) {
        const reader = new FileReader()
        const content = await new Promise<string>((resolve) => {
          reader.onload = () => resolve(reader.result as string)
          reader.readAsText(file)
        })

        try {
          const data = JSON.parse(content)
          if (data.pages && Array.isArray(data.pages)) {
            loadLayoutData(data)
            showToast(`Loaded layout from ${file.name}`)
            return
          }
        } catch {
          showToast(`Failed to parse ${file.name}`, 'error')
          return
        }
      }
    }

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
  }, [addFilesToCells, loadLayoutData, showToast])

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
      <div className="toast-container">
        {toasts.map(toast => (
          <Toast
            key={toast.id}
            message={toast.message}
            type={toast.type}
            onClose={() => removeToast(toast.id)}
          />
        ))}
      </div>
    </>
  )
}

export default App
