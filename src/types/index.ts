export type PageSize = 'A4' | 'A3'

export interface Toast {
  id: string
  message: string
  type: 'success' | 'error' | 'info'
}

export interface CellContent {
  imageData: string
  filename: string
  originalPath: string
}

export interface Cell {
  id: string
  content: CellContent | null
}

export interface Page {
  id: string
  cells: Cell[]
}

export interface GridPreset {
  name: string
  rows: number
  cols: number
}

export interface LayoutState {
  pageSize: PageSize
  pages: Page[]
  currentPageIndex: number
  rows: number
  cols: number
  gap: number
  margin: number
  showFilenames: boolean
  showGridLines: boolean
  showPageNumbers: boolean
  title: string
  selectedCellId: string | null
  darkMode: boolean
  zoom: number
  toasts: Toast[]
}

export interface LayoutActions {
  setPageSize: (size: PageSize) => void
  addPage: () => void
  removePage: (index: number) => void
  setCurrentPage: (index: number) => void
  setGrid: (rows: number, cols: number) => void
  setGap: (gap: number) => void
  setMargin: (margin: number) => void
  setShowFilenames: (show: boolean) => void
  setShowGridLines: (show: boolean) => void
  setShowPageNumbers: (show: boolean) => void
  setTitle: (title: string) => void
  setDarkMode: (dark: boolean) => void
  setZoom: (zoom: number) => void
  setCellContent: (pageIndex: number, cellIndex: number, content: CellContent | null) => void
  selectCell: (cellId: string | null) => void
  clearSelectedCell: () => void
  addFilesToCells: (files: { imageData: string; filename: string; originalPath: string }[]) => void
  swapCells: (fromPageIndex: number, fromCellIndex: number, toPageIndex: number, toCellIndex: number) => void
  movePage: (fromIndex: number, toIndex: number) => void
  moveCell: (pageIndex: number, fromCellIndex: number, toCellIndex: number) => void
  loadLayoutData: (data: any) => void
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void
  removeToast: (id: string) => void
}

declare global {
  interface Window {
    electronAPI: {
      readFile: (filePath: string) => Promise<string | null>
      exportPDF: (data: any) => Promise<{ success: boolean; filePath?: string; canceled?: boolean; error?: string }>
      saveLayout: (data: any) => Promise<{ success: boolean; filePath?: string; canceled?: boolean; error?: string }>
      loadLayout: () => Promise<{ success: boolean; data?: any; canceled?: boolean; error?: string }>
      packageLayout: (data: any) => Promise<{ success: boolean; filePath?: string; fileCount?: number; canceled?: boolean; error?: string }>
    }
  }
}
