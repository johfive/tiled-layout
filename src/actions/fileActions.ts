import { useLayoutStore } from '../stores/layoutStore'

export function handleNew() {
  const { isDirty, resetToNew, showToast } = useLayoutStore.getState()
  if (isDirty) {
    const confirmed = window.confirm('You have unsaved changes. Create a new document and discard changes?')
    if (!confirmed) return
  }
  resetToNew()
  showToast('New document created')
}

export async function handleSave() {
  const { pages, pageSize, showFilenames, showGridLines, showPageNumbers, title, darkMode, zoom, markClean, showToast } = useLayoutStore.getState()

  const layoutData = {
    pages: pages.map(page => ({
      id: page.id,
      cells: page.cells.map(cell => ({
        id: cell.id,
        content: cell.content
      })),
      gridSettings: page.gridSettings,
      hiddenContent: page.hiddenContent
    })),
    pageSize,
    showFilenames,
    showGridLines,
    showPageNumbers,
    title,
    darkMode,
    zoom
  }

  const result = await window.electronAPI.saveLayout(layoutData)
  if (result.success) {
    markClean()
    showToast(`Layout saved to ${result.filePath}`)
  } else if (!result.canceled) {
    showToast(`Save failed: ${result.error}`, 'error')
  }
}

export async function handleLoad() {
  const { loadLayoutData, showToast } = useLayoutStore.getState()

  const result = await window.electronAPI.loadLayout()
  if (result.success && result.data) {
    loadLayoutData(result.data)
    showToast('Layout loaded')
  } else if (!result.canceled && result.error) {
    showToast(`Load failed: ${result.error}`, 'error')
  }
}

export async function handlePackage() {
  const { pages, showToast } = useLayoutStore.getState()

  const packageData = {
    pages: pages.map(page => ({
      cells: page.cells.map(cell => ({
        imageData: cell.content?.imageData || null,
        filename: cell.content?.filename || null
      }))
    })),
    asZip: true
  }

  const result = await window.electronAPI.packageLayout(packageData)
  if (result.success) {
    showToast(`Package saved (${result.fileCount} files)`)
  } else if (!result.canceled) {
    showToast(`Package failed: ${result.error}`, 'error')
  }
}

export async function handleExport() {
  const { pages, pageSize, showFilenames, showPageNumbers, title, showToast } = useLayoutStore.getState()

  const exportData = {
    pages: pages.map(page => ({
      cells: page.cells.map(cell => ({
        imageData: cell.content?.imageData || null,
        filename: cell.content?.filename || null
      })),
      gridSettings: page.gridSettings
    })),
    pageSize,
    showFilenames,
    showPageNumbers,
    title
  }

  const result = await window.electronAPI.exportPDF(exportData)
  if (result.success) {
    showToast(`PDF exported to ${result.filePath}`)
  } else if (!result.canceled) {
    showToast(`Export failed: ${result.error}`, 'error')
  }
}

export function handleToggleDarkMode() {
  const { darkMode, setDarkMode } = useLayoutStore.getState()
  setDarkMode(!darkMode)
}
