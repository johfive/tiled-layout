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

export interface PageGridSettings {
  rows: number
  cols: number
  gap: number
  margin: number
}

export interface Page {
  id: string
  cells: Cell[]
  gridSettings: PageGridSettings
  hiddenContent: CellContent[]  // Content that doesn't fit current grid
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
  // Default grid settings for new pages
  defaultRows: number
  defaultCols: number
  defaultGap: number
  defaultMargin: number
  showFilenames: boolean
  showGridLines: boolean
  showPageNumbers: boolean
  title: string
  selectedCellId: string | null
  darkMode: boolean
  zoom: number
  toasts: Toast[]
  isDirty: boolean  // Track if document has unsaved changes
}

export interface LayoutActions {
  setPageSize: (size: PageSize) => void
  addPage: () => void
  removePage: (index: number) => void
  setCurrentPage: (index: number) => void
  // Per-page grid settings
  setPageGrid: (pageIndex: number, rows: number, cols: number) => void
  setPageGap: (pageIndex: number, gap: number) => void
  setPageMargin: (pageIndex: number, margin: number) => void
  restoreHiddenContent: (pageIndex: number) => void
  // Default settings for new pages
  setDefaultGrid: (rows: number, cols: number) => void
  setDefaultGap: (gap: number) => void
  setDefaultMargin: (margin: number) => void
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
  getCurrentPageGridSettings: () => PageGridSettings
  resetToNew: () => void
  markDirty: () => void
  markClean: () => void
}

declare global {
  interface Window {
    electronAPI: {
      readFile: (filePath: string) => Promise<string | null>
      exportPDF: (data: any) => Promise<{ success: boolean; filePath?: string; canceled?: boolean; error?: string }>
      saveLayout: (data: any) => Promise<{ success: boolean; filePath?: string; canceled?: boolean; error?: string }>
      loadLayout: () => Promise<{ success: boolean; data?: any; canceled?: boolean; error?: string }>
      loadLayoutFromPath: (filePath: string) => Promise<{ success: boolean; data?: any; error?: string }>
      packageLayout: (data: any) => Promise<{ success: boolean; filePath?: string; fileCount?: number; canceled?: boolean; error?: string }>
      onOpenFile: (callback: (filePath: string) => void) => void
      onMenuNew: (callback: () => void) => void
      onMenuSave: (callback: () => void) => void
      onMenuLoad: (callback: () => void) => void
      onMenuPackage: (callback: () => void) => void
      onMenuExportPDF: (callback: () => void) => void
      onMenuToggleDarkMode: (callback: () => void) => void
    }
  }
}
