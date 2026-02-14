import { create } from 'zustand'
import { LayoutState, LayoutActions, Page, Cell, PageSize, CellContent, Toast, PageGridSettings } from '../types'

const createCells = (rows: number, cols: number): Cell[] => {
  return Array.from({ length: rows * cols }, (_, i) => ({
    id: `cell-${Date.now()}-${i}`,
    content: null
  }))
}

const createPage = (gridSettings: PageGridSettings): Page => ({
  id: `page-${Date.now()}`,
  cells: createCells(gridSettings.rows, gridSettings.cols),
  gridSettings: { ...gridSettings },
  hiddenContent: []
})

const DEFAULT_GRID_SETTINGS: PageGridSettings = {
  rows: 2,
  cols: 2,
  gap: 5,
  margin: 10
}

// Read dark mode preference from localStorage on init
const getInitialDarkMode = (): boolean => {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('darkMode')
    if (stored !== null) {
      const isDark = stored === 'true'
      if (isDark) {
        document.documentElement.classList.add('dark')
      }
      return isDark
    }
  }
  return false
}

interface LayoutStore extends LayoutState, LayoutActions {}

export const useLayoutStore = create<LayoutStore>((set, get) => ({
  // State
  pageSize: 'A4',
  pages: [createPage(DEFAULT_GRID_SETTINGS)],
  currentPageIndex: 0,
  defaultRows: 2,
  defaultCols: 2,
  defaultGap: 5,
  defaultMargin: 10,
  showFilenames: true,
  showGridLines: true,
  showPageNumbers: false,
  title: '',
  selectedCellId: null,
  darkMode: getInitialDarkMode(),
  zoom: 1,
  toasts: [],
  isDirty: false,

  // Actions
  markDirty: () => set({ isDirty: true }),
  markClean: () => set({ isDirty: false }),

  resetToNew: () => {
    set({
      pageSize: 'A4',
      pages: [createPage(DEFAULT_GRID_SETTINGS)],
      currentPageIndex: 0,
      defaultRows: 2,
      defaultCols: 2,
      defaultGap: 5,
      defaultMargin: 10,
      showFilenames: true,
      showGridLines: true,
      showPageNumbers: false,
      title: '',
      selectedCellId: null,
      zoom: 1,
      isDirty: false
    })
  },

  getCurrentPageGridSettings: () => {
    const { pages, currentPageIndex, defaultRows, defaultCols, defaultGap, defaultMargin } = get()
    const currentPage = pages[currentPageIndex]
    if (currentPage?.gridSettings) {
      return currentPage.gridSettings
    }
    return { rows: defaultRows, cols: defaultCols, gap: defaultGap, margin: defaultMargin }
  },

  setPageSize: (size: PageSize) => {
    set({ pageSize: size, selectedCellId: null, isDirty: true })
  },

  addPage: () => {
    const { pages, defaultRows, defaultCols, defaultGap, defaultMargin } = get()
    const newPage = createPage({
      rows: defaultRows,
      cols: defaultCols,
      gap: defaultGap,
      margin: defaultMargin
    })
    set({
      pages: [...pages, newPage],
      currentPageIndex: pages.length,
      isDirty: true
    })
  },

  removePage: (index: number) => {
    const { pages, currentPageIndex } = get()
    if (pages.length <= 1) return

    const newPages = pages.filter((_, i) => i !== index)
    const newCurrentIndex = currentPageIndex >= newPages.length
      ? newPages.length - 1
      : currentPageIndex > index
        ? currentPageIndex - 1
        : currentPageIndex

    set({
      pages: newPages,
      currentPageIndex: newCurrentIndex,
      selectedCellId: null,
      isDirty: true
    })
  },

  setCurrentPage: (index: number) => {
    set({ currentPageIndex: index, selectedCellId: null })
  },

  setPageGrid: (pageIndex: number, rows: number, cols: number) => {
    const { pages } = get()
    const page = pages[pageIndex]
    if (!page) return

    const newCellCount = rows * cols

    // Collect all visible content
    const visibleContent: CellContent[] = []
    for (const cell of page.cells) {
      if (cell.content) {
        visibleContent.push(cell.content)
      }
    }

    // Combine with any existing hidden content
    const allContent = [...visibleContent, ...page.hiddenContent]

    // Create new cells
    const newCells = createCells(rows, cols)

    // Distribute content to visible cells, overflow goes to hidden
    const contentForCells = allContent.slice(0, newCellCount)
    const hiddenContent = allContent.slice(newCellCount)

    for (let i = 0; i < contentForCells.length; i++) {
      newCells[i] = { ...newCells[i], content: contentForCells[i] }
    }

    const newPages = [...pages]
    newPages[pageIndex] = {
      ...page,
      cells: newCells,
      gridSettings: { ...page.gridSettings, rows, cols },
      hiddenContent
    }

    set({ pages: newPages, selectedCellId: null, isDirty: true })
  },

  setPageGap: (pageIndex: number, gap: number) => {
    const { pages } = get()
    const page = pages[pageIndex]
    if (!page) return

    const newPages = [...pages]
    newPages[pageIndex] = {
      ...page,
      gridSettings: { ...page.gridSettings, gap }
    }

    set({ pages: newPages, isDirty: true })
  },

  setPageMargin: (pageIndex: number, margin: number) => {
    const { pages } = get()
    const page = pages[pageIndex]
    if (!page) return

    const newPages = [...pages]
    newPages[pageIndex] = {
      ...page,
      gridSettings: { ...page.gridSettings, margin }
    }

    set({ pages: newPages, isDirty: true })
  },

  restoreHiddenContent: (pageIndex: number) => {
    const { pages } = get()
    const page = pages[pageIndex]
    if (!page || page.hiddenContent.length === 0) return

    // Find empty cells and fill them with hidden content
    const newCells = [...page.cells]
    const remainingHidden = [...page.hiddenContent]

    for (let i = 0; i < newCells.length && remainingHidden.length > 0; i++) {
      if (!newCells[i].content) {
        newCells[i] = { ...newCells[i], content: remainingHidden.shift()! }
      }
    }

    const newPages = [...pages]
    newPages[pageIndex] = {
      ...page,
      cells: newCells,
      hiddenContent: remainingHidden
    }

    set({ pages: newPages, isDirty: true })
  },

  setDefaultGrid: (rows: number, cols: number) => {
    set({ defaultRows: rows, defaultCols: cols })
  },

  setDefaultGap: (gap: number) => set({ defaultGap: gap }),

  setDefaultMargin: (margin: number) => set({ defaultMargin: margin }),

  setShowFilenames: (show: boolean) => set({ showFilenames: show }),

  setShowGridLines: (show: boolean) => set({ showGridLines: show }),

  setShowPageNumbers: (show: boolean) => set({ showPageNumbers: show }),

  setTitle: (title: string) => set({ title, isDirty: true }),

  setDarkMode: (dark: boolean) => {
    set({ darkMode: dark })
    localStorage.setItem('darkMode', String(dark))
    if (dark) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  },

  setZoom: (zoom: number) => {
    const clampedZoom = Math.max(0.25, Math.min(3, zoom))
    set({ zoom: clampedZoom })
  },

  setCellContent: (pageIndex: number, cellIndex: number, content: CellContent | null) => {
    const { pages } = get()
    const newPages = [...pages]
    const newCells = [...newPages[pageIndex].cells]
    newCells[cellIndex] = { ...newCells[cellIndex], content }
    newPages[pageIndex] = { ...newPages[pageIndex], cells: newCells }
    set({ pages: newPages, isDirty: true })
  },

  selectCell: (cellId: string | null) => set({ selectedCellId: cellId }),

  clearSelectedCell: () => {
    const { selectedCellId, pages, currentPageIndex } = get()
    if (!selectedCellId) return

    const currentPage = pages[currentPageIndex]
    const cellIndex = currentPage.cells.findIndex(c => c.id === selectedCellId)
    if (cellIndex === -1) return

    const newPages = [...pages]
    const newCells = [...newPages[currentPageIndex].cells]
    newCells[cellIndex] = { ...newCells[cellIndex], content: null }
    newPages[currentPageIndex] = { ...newPages[currentPageIndex], cells: newCells }
    set({ pages: newPages, isDirty: true })
  },

  addFilesToCells: (files) => {
    const { pages, defaultRows, defaultCols, defaultGap, defaultMargin } = get()
    let newPages = [...pages]
    let fileIdx = 0

    // Find first empty cell starting from first page
    for (let p = 0; p < newPages.length && fileIdx < files.length; p++) {
      const page = newPages[p]
      for (let c = 0; c < page.cells.length && fileIdx < files.length; c++) {
        if (!page.cells[c].content) {
          const newCells = [...page.cells]
          newCells[c] = {
            ...newCells[c],
            content: {
              imageData: files[fileIdx].imageData,
              filename: files[fileIdx].filename,
              originalPath: files[fileIdx].originalPath
            }
          }
          newPages[p] = { ...page, cells: newCells }
          fileIdx++
        }
      }
    }

    // Create new pages for remaining files
    while (fileIdx < files.length) {
      const gridSettings = {
        rows: defaultRows,
        cols: defaultCols,
        gap: defaultGap,
        margin: defaultMargin
      }
      const newPage = createPage(gridSettings)
      const newCells = [...newPage.cells]

      for (let c = 0; c < newCells.length && fileIdx < files.length; c++) {
        newCells[c] = {
          ...newCells[c],
          content: {
            imageData: files[fileIdx].imageData,
            filename: files[fileIdx].filename,
            originalPath: files[fileIdx].originalPath
          }
        }
        fileIdx++
      }

      newPages.push({ ...newPage, cells: newCells })
    }

    set({ pages: newPages, currentPageIndex: newPages.length - 1, isDirty: true })
  },

  swapCells: (fromPageIndex, fromCellIndex, toPageIndex, toCellIndex) => {
    const { pages } = get()
    const newPages = [...pages]

    const fromContent = newPages[fromPageIndex].cells[fromCellIndex].content
    const toContent = newPages[toPageIndex].cells[toCellIndex].content

    const newFromCells = [...newPages[fromPageIndex].cells]
    const newToCells = fromPageIndex === toPageIndex ? newFromCells : [...newPages[toPageIndex].cells]

    newFromCells[fromCellIndex] = { ...newFromCells[fromCellIndex], content: toContent }
    newToCells[toCellIndex] = { ...newToCells[toCellIndex], content: fromContent }

    newPages[fromPageIndex] = { ...newPages[fromPageIndex], cells: newFromCells }
    if (fromPageIndex !== toPageIndex) {
      newPages[toPageIndex] = { ...newPages[toPageIndex], cells: newToCells }
    }

    set({ pages: newPages, isDirty: true })
  },

  movePage: (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return
    const { pages, currentPageIndex } = get()
    const newPages = [...pages]
    const [movedPage] = newPages.splice(fromIndex, 1)
    newPages.splice(toIndex, 0, movedPage)

    // Update current page index if needed
    let newCurrentIndex = currentPageIndex
    if (currentPageIndex === fromIndex) {
      newCurrentIndex = toIndex
    } else if (fromIndex < currentPageIndex && toIndex >= currentPageIndex) {
      newCurrentIndex = currentPageIndex - 1
    } else if (fromIndex > currentPageIndex && toIndex <= currentPageIndex) {
      newCurrentIndex = currentPageIndex + 1
    }

    set({ pages: newPages, currentPageIndex: newCurrentIndex, isDirty: true })
  },

  moveCell: (pageIndex: number, fromCellIndex: number, toCellIndex: number) => {
    if (fromCellIndex === toCellIndex) return
    const { pages } = get()
    const newPages = [...pages]
    const newCells = [...newPages[pageIndex].cells]

    // Swap the content between cells
    const fromContent = newCells[fromCellIndex].content
    const toContent = newCells[toCellIndex].content
    newCells[fromCellIndex] = { ...newCells[fromCellIndex], content: toContent }
    newCells[toCellIndex] = { ...newCells[toCellIndex], content: fromContent }

    newPages[pageIndex] = { ...newPages[pageIndex], cells: newCells }
    set({ pages: newPages, isDirty: true })
  },

  loadLayoutData: (data: any) => {
    // Dark mode is an app preference (persisted in localStorage), not a document setting.
    // Don't override it when loading a file.

    // Migrate old format (global grid settings) to new format (per-page)
    const migratedPages = (data.pages || []).map((page: any) => {
      // If page already has gridSettings, use them
      if (page.gridSettings) {
        return {
          ...page,
          hiddenContent: page.hiddenContent || []
        }
      }
      // Otherwise, use global settings from data or defaults
      return {
        ...page,
        gridSettings: {
          rows: data.rows || 2,
          cols: data.cols || 2,
          gap: data.gap || 5,
          margin: data.margin || 10
        },
        hiddenContent: []
      }
    })

    set({
      pageSize: data.pageSize || 'A4',
      pages: migratedPages,
      defaultRows: data.defaultRows || data.rows || 2,
      defaultCols: data.defaultCols || data.cols || 2,
      defaultGap: data.defaultGap || data.gap || 5,
      defaultMargin: data.defaultMargin || data.margin || 10,
      showFilenames: data.showFilenames ?? true,
      showGridLines: data.showGridLines ?? true,
      showPageNumbers: data.showPageNumbers ?? false,
      title: data.title || '',
      zoom: data.zoom || 1,
      currentPageIndex: 0,
      selectedCellId: null,
      isDirty: false  // Just loaded, so not dirty
    })
  },

  showToast: (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    const toast: Toast = {
      id: `toast-${Date.now()}`,
      message,
      type
    }
    set(state => ({ toasts: [...state.toasts, toast] }))
  },

  removeToast: (id: string) => {
    set(state => ({ toasts: state.toasts.filter(t => t.id !== id) }))
  }
}))
