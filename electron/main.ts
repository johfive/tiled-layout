import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import PDFDocument from 'pdfkit'
import SVGtoPDF from 'svg-to-pdfkit'
import archiver from 'archiver'
import AdmZip from 'adm-zip'

// ES module compatibility
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

let mainWindow: BrowserWindow | null = null
let fileToOpen: string | null = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    },
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 15, y: 15 }
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

app.whenReady().then(() => {
  createWindow()

  // If a file was passed via command line or open-file before window was ready
  if (fileToOpen && mainWindow) {
    mainWindow.webContents.once('did-finish-load', () => {
      if (fileToOpen) {
        mainWindow?.webContents.send('open-file', fileToOpen)
        fileToOpen = null
      }
    })
  }
})

// Handle file open events on macOS (double-click .tlp file in Finder)
app.on('open-file', (event, filePath) => {
  event.preventDefault()

  if (mainWindow) {
    // Window is already open, send the file path to the renderer
    mainWindow.webContents.send('open-file', filePath)
  } else {
    // Window not yet created, store the path and load after window is ready
    fileToOpen = filePath
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

// IPC Handlers
ipcMain.handle('read-file', async (_event, filePath: string) => {
  try {
    const buffer = fs.readFileSync(filePath)
    return buffer.toString('base64')
  } catch (error) {
    console.error('Error reading file:', error)
    return null
  }
})

ipcMain.handle('export-pdf', async (_event, data: {
  pages: Array<{
    cells: Array<{
      imageData: string | null
      filename: string | null
    }>
    gridSettings: {
      rows: number
      cols: number
      gap: number
      margin: number
    }
  }>
  pageSize: 'A4' | 'A3'
  showFilenames: boolean
  showPageNumbers: boolean
  title: string
}) => {
  if (!mainWindow) {
    return { success: false, error: 'No main window' }
  }

  const { filePath, canceled } = await dialog.showSaveDialog(mainWindow, {
    title: 'Export PDF',
    defaultPath: 'layout.pdf',
    filters: [{ name: 'PDF Files', extensions: ['pdf'] }]
  })

  if (canceled || !filePath) {
    return { success: false, canceled: true }
  }

  try {
    console.log('PDF Export - Pages:', data.pages.length)

    // Page dimensions in points (1 inch = 72 points, 1 mm = 2.834645669 points)
    const mmToPoints = 2.834645669
    const pageSizes = {
      A4: { width: 210 * mmToPoints, height: 297 * mmToPoints },
      A3: { width: 297 * mmToPoints, height: 420 * mmToPoints }
    }

    const pageSize = pageSizes[data.pageSize]
    const totalPages = data.pages.length

    return new Promise((resolve) => {
      const doc = new PDFDocument({
        size: [pageSize.width, pageSize.height],
        margin: 0,
        autoFirstPage: false
      })

      const writeStream = fs.createWriteStream(filePath)
      doc.pipe(writeStream)

      // Set up SFMono font - try to find it, fall back to Courier
      const sfMonoPaths = [
        '/System/Applications/Utilities/Terminal.app/Contents/Resources/Fonts/SF-Mono-Regular.otf',
        '/Applications/Utilities/Terminal.app/Contents/Resources/Fonts/SF-Mono-Regular.otf',
        '/System/Library/Fonts/SFMono-Regular.otf',
        '/System/Library/Fonts/SFMono/SFMono-Regular.otf'
      ]

      let fontPath: string | null = null
      for (const p of sfMonoPaths) {
        if (fs.existsSync(p)) {
          fontPath = p
          break
        }
      }

      for (let pageIndex = 0; pageIndex < data.pages.length; pageIndex++) {
        const pageData = data.pages[pageIndex]
        doc.addPage({ size: [pageSize.width, pageSize.height], margin: 0 })

        // Get this page's grid settings
        const { rows, cols, gap, margin } = pageData.gridSettings
        const marginPts = margin * mmToPoints
        const gapPts = gap * mmToPoints

        const contentWidth = pageSize.width - (2 * marginPts)
        const contentHeight = pageSize.height - (2 * marginPts)

        const cellWidth = (contentWidth - (gapPts * (cols - 1))) / cols
        const cellHeight = (contentHeight - (gapPts * (rows - 1))) / rows

        // Reserve space for filename if showing
        const filenameHeight = data.showFilenames ? 12 : 0
        const imageAreaHeight = cellHeight - filenameHeight

        // Set font for this page
        if (fontPath) {
          doc.font(fontPath)
        } else {
          doc.font('Courier')
        }

        // Draw title at top if enabled
        if (data.title) {
          doc.fontSize(10)
             .fillColor('#666666')
             .text(data.title, 0, 15, {
               width: pageSize.width,
               align: 'center'
             })
        }

        // Draw page number at bottom if enabled
        if (data.showPageNumbers) {
          doc.fontSize(10)
             .fillColor('#666666')
             .text(`${pageIndex + 1}/${totalPages}`, 0, pageSize.height - 25, {
               width: pageSize.width,
               align: 'center'
             })
        }

        for (let i = 0; i < pageData.cells.length; i++) {
          const cell = pageData.cells[i]
          if (!cell.imageData) continue

          const row = Math.floor(i / cols)
          const col = i % cols

          const cellX = marginPts + (col * (cellWidth + gapPts))
          const cellY = marginPts + (row * (cellHeight + gapPts))

          try {
            const mimeType = cell.imageData.split(';')[0].split(':')[1]
            const base64Data = cell.imageData.split(',')[1]

            if (mimeType === 'image/svg+xml') {
              // Decode SVG and embed as vector
              const svgString = Buffer.from(base64Data, 'base64').toString('utf-8')

              // Parse SVG to get dimensions
              const widthMatch = svgString.match(/width="([^"]+)"/)
              const heightMatch = svgString.match(/height="([^"]+)"/)
              const viewBoxMatch = svgString.match(/viewBox="([^"]+)"/)

              let svgWidth = 100, svgHeight = 100
              if (viewBoxMatch) {
                const [, , w, h] = viewBoxMatch[1].split(/\s+/).map(Number)
                svgWidth = w || 100
                svgHeight = h || 100
              } else {
                if (widthMatch) svgWidth = parseFloat(widthMatch[1]) || 100
                if (heightMatch) svgHeight = parseFloat(heightMatch[1]) || 100
              }

              // Calculate fit dimensions
              const imgAspect = svgWidth / svgHeight
              const cellAspect = cellWidth / imageAreaHeight

              let drawWidth, drawHeight
              if (imgAspect > cellAspect) {
                drawWidth = cellWidth
                drawHeight = cellWidth / imgAspect
              } else {
                drawHeight = imageAreaHeight
                drawWidth = imageAreaHeight * imgAspect
              }

              const drawX = cellX + (cellWidth - drawWidth) / 2
              const drawY = cellY + (imageAreaHeight - drawHeight) / 2

              // Draw SVG as vector
              doc.save()
              SVGtoPDF(doc, svgString, drawX, drawY, {
                width: drawWidth,
                height: drawHeight,
                preserveAspectRatio: 'xMidYMid meet'
              })
              doc.restore()
            } else if (mimeType === 'image/png' || mimeType === 'image/jpeg' || mimeType === 'image/jpg') {
              // Embed raster image
              const imageBuffer = Buffer.from(base64Data, 'base64')

              // Get image dimensions by parsing the buffer
              const img = doc.openImage(imageBuffer)
              const imgAspect = img.width / img.height
              const cellAspect = cellWidth / imageAreaHeight

              let drawWidth, drawHeight
              if (imgAspect > cellAspect) {
                drawWidth = cellWidth
                drawHeight = cellWidth / imgAspect
              } else {
                drawHeight = imageAreaHeight
                drawWidth = imageAreaHeight * imgAspect
              }

              const drawX = cellX + (cellWidth - drawWidth) / 2
              const drawY = cellY + (imageAreaHeight - drawHeight) / 2

              doc.image(imageBuffer, drawX, drawY, {
                width: drawWidth,
                height: drawHeight
              })
            }

            // Draw filename if enabled
            if (data.showFilenames && cell.filename) {
              // Reset to SFMono (SVGtoPDF may have changed the font)
              if (fontPath) {
                doc.font(fontPath)
              } else {
                doc.font('Courier')
              }
              doc.fontSize(8)
                 .fillColor('#4d4d4d')

              const textY = cellY + imageAreaHeight + 2
              doc.text(cell.filename, cellX, textY, {
                width: cellWidth,
                align: 'center',
                ellipsis: true,
                height: filenameHeight,
                lineBreak: false
              })
            }
          } catch (imgError) {
            console.error('Error embedding image:', imgError)
          }
        }
      }

      doc.end()

      writeStream.on('finish', () => {
        resolve({ success: true, filePath })
      })

      writeStream.on('error', (err) => {
        resolve({ success: false, error: String(err) })
      })
    })
  } catch (error) {
    console.error('Error exporting PDF:', error)
    return { success: false, error: String(error) }
  }
})

// Save layout as .tlp (ZIP with images and layout.json)
ipcMain.handle('save-layout', async (_event, data: any) => {
  if (!mainWindow) {
    return { success: false, error: 'No main window' }
  }

  const { filePath, canceled } = await dialog.showSaveDialog(mainWindow, {
    title: 'Save Layout',
    defaultPath: 'layout.tlp',
    filters: [{ name: 'Tiled Layout Package', extensions: ['tlp'] }]
  })

  if (canceled || !filePath) {
    return { success: false, canceled: true }
  }

  try {
    // Collect unique images and build a mapping
    const images: Map<string, { filename: string; data: string; uniqueName: string }> = new Map()
    let imageIndex = 0

    // First pass: collect all unique images
    for (const page of data.pages) {
      for (const cell of page.cells) {
        if (cell.content?.imageData) {
          const key = cell.content.imageData
          if (!images.has(key)) {
            // Generate a unique filename to avoid collisions
            const ext = getExtensionFromDataUrl(cell.content.imageData)
            const uniqueName = `image_${imageIndex++}${ext}`
            images.set(key, {
              filename: cell.content.filename,
              data: cell.content.imageData,
              uniqueName
            })
          }
        }
      }
      // Also collect from hiddenContent
      for (const hidden of page.hiddenContent || []) {
        if (hidden.imageData) {
          const key = hidden.imageData
          if (!images.has(key)) {
            const ext = getExtensionFromDataUrl(hidden.imageData)
            const uniqueName = `image_${imageIndex++}${ext}`
            images.set(key, {
              filename: hidden.filename,
              data: hidden.imageData,
              uniqueName
            })
          }
        }
      }
    }

    // Create layout data with image references instead of base64
    const layoutData = {
      ...data,
      pages: data.pages.map((page: any) => ({
        ...page,
        cells: page.cells.map((cell: any) => ({
          ...cell,
          content: cell.content ? {
            filename: cell.content.filename,
            originalPath: cell.content.originalPath,
            imageRef: images.get(cell.content.imageData)?.uniqueName || null
          } : null
        })),
        hiddenContent: (page.hiddenContent || []).map((hidden: any) => ({
          filename: hidden.filename,
          originalPath: hidden.originalPath,
          imageRef: images.get(hidden.imageData)?.uniqueName || null
        }))
      }))
    }

    // Create ZIP file
    const output = fs.createWriteStream(filePath)
    const archive = archiver('zip', { zlib: { level: 9 } })

    return new Promise((resolve) => {
      output.on('close', () => {
        resolve({ success: true, filePath })
      })

      archive.on('error', (err) => {
        resolve({ success: false, error: String(err) })
      })

      archive.pipe(output)

      // Add images to images/ folder
      for (const [, img] of images) {
        const base64Data = img.data.split(',')[1]
        const buffer = Buffer.from(base64Data, 'base64')
        archive.append(buffer, { name: `images/${img.uniqueName}` })
      }

      // Add layout.json
      archive.append(JSON.stringify(layoutData, null, 2), { name: 'layout.json' })

      archive.finalize()
    })
  } catch (error) {
    console.error('Error saving layout:', error)
    return { success: false, error: String(error) }
  }
})

// Helper function to get file extension from data URL
function getExtensionFromDataUrl(dataUrl: string): string {
  const match = dataUrl.match(/^data:image\/([^;]+);/)
  if (match) {
    const type = match[1].toLowerCase()
    if (type === 'jpeg') return '.jpg'
    if (type === 'svg+xml') return '.svg'
    return `.${type}`
  }
  return '.png'
}

// Load layout from .tlp (ZIP) or .json
ipcMain.handle('load-layout', async () => {
  if (!mainWindow) {
    return { success: false, error: 'No main window' }
  }

  const { filePaths, canceled } = await dialog.showOpenDialog(mainWindow, {
    title: 'Load Layout',
    filters: [
      { name: 'Tiled Layout Package', extensions: ['tlp'] },
      { name: 'JSON Files', extensions: ['json'] },
      { name: 'All Layout Files', extensions: ['tlp', 'json'] }
    ],
    properties: ['openFile']
  })

  if (canceled || filePaths.length === 0) {
    return { success: false, canceled: true }
  }

  try {
    const filePath = filePaths[0]
    const ext = path.extname(filePath).toLowerCase()

    if (ext === '.tlp') {
      // Load from ZIP package
      const zip = new AdmZip(filePath)
      const layoutEntry = zip.getEntry('layout.json')

      if (!layoutEntry) {
        return { success: false, error: 'Invalid .tlp file: missing layout.json' }
      }

      const layoutData = JSON.parse(layoutEntry.getData().toString('utf-8'))

      // Build image map from ZIP
      const imageMap: Map<string, string> = new Map()
      const zipEntries = zip.getEntries()

      for (const entry of zipEntries) {
        if (entry.entryName.startsWith('images/') && !entry.isDirectory) {
          const imageName = path.basename(entry.entryName)
          const imageBuffer = entry.getData()
          const mimeType = getMimeTypeFromFilename(imageName)
          const base64 = imageBuffer.toString('base64')
          imageMap.set(imageName, `data:${mimeType};base64,${base64}`)
        }
      }

      // Reconstruct layout with base64 image data
      const data = {
        ...layoutData,
        pages: layoutData.pages.map((page: any) => ({
          ...page,
          cells: page.cells.map((cell: any) => ({
            ...cell,
            content: cell.content ? {
              filename: cell.content.filename,
              originalPath: cell.content.originalPath,
              imageData: cell.content.imageRef ? imageMap.get(cell.content.imageRef) || '' : ''
            } : null
          })),
          hiddenContent: (page.hiddenContent || []).map((hidden: any) => ({
            filename: hidden.filename,
            originalPath: hidden.originalPath,
            imageData: hidden.imageRef ? imageMap.get(hidden.imageRef) || '' : ''
          }))
        }))
      }

      return { success: true, data }
    } else {
      // Load from JSON (legacy format)
      const content = fs.readFileSync(filePath, 'utf-8')
      const data = JSON.parse(content)
      return { success: true, data }
    }
  } catch (error) {
    console.error('Error loading layout:', error)
    return { success: false, error: String(error) }
  }
})

// Helper function to get MIME type from filename
function getMimeTypeFromFilename(filename: string): string {
  const ext = path.extname(filename).toLowerCase()
  const mimeTypes: Record<string, string> = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml'
  }
  return mimeTypes[ext] || 'image/png'
}

// Load layout from a specific file path (for drag-drop support)
ipcMain.handle('load-layout-from-path', async (_event, filePath: string) => {
  try {
    const ext = path.extname(filePath).toLowerCase()

    if (ext === '.tlp') {
      // Load from ZIP package
      const zip = new AdmZip(filePath)
      const layoutEntry = zip.getEntry('layout.json')

      if (!layoutEntry) {
        return { success: false, error: 'Invalid .tlp file: missing layout.json' }
      }

      const layoutData = JSON.parse(layoutEntry.getData().toString('utf-8'))

      // Build image map from ZIP
      const imageMap: Map<string, string> = new Map()
      const zipEntries = zip.getEntries()

      for (const entry of zipEntries) {
        if (entry.entryName.startsWith('images/') && !entry.isDirectory) {
          const imageName = path.basename(entry.entryName)
          const imageBuffer = entry.getData()
          const mimeType = getMimeTypeFromFilename(imageName)
          const base64 = imageBuffer.toString('base64')
          imageMap.set(imageName, `data:${mimeType};base64,${base64}`)
        }
      }

      // Reconstruct layout with base64 image data
      const data = {
        ...layoutData,
        pages: layoutData.pages.map((page: any) => ({
          ...page,
          cells: page.cells.map((cell: any) => ({
            ...cell,
            content: cell.content ? {
              filename: cell.content.filename,
              originalPath: cell.content.originalPath,
              imageData: cell.content.imageRef ? imageMap.get(cell.content.imageRef) || '' : ''
            } : null
          })),
          hiddenContent: (page.hiddenContent || []).map((hidden: any) => ({
            filename: hidden.filename,
            originalPath: hidden.originalPath,
            imageData: hidden.imageRef ? imageMap.get(hidden.imageRef) || '' : ''
          }))
        }))
      }

      return { success: true, data }
    } else if (ext === '.json') {
      // Load from JSON (legacy format)
      const content = fs.readFileSync(filePath, 'utf-8')
      const data = JSON.parse(content)
      return { success: true, data }
    } else {
      return { success: false, error: 'Unsupported file type' }
    }
  } catch (error) {
    console.error('Error loading layout from path:', error)
    return { success: false, error: String(error) }
  }
})

// Package/Collect - export as folder with images
ipcMain.handle('package-layout', async (_event, data: {
  pages: Array<{
    cells: Array<{
      imageData: string | null
      filename: string | null
    }>
  }>
  asZip: boolean
}) => {
  if (!mainWindow) {
    return { success: false, error: 'No main window' }
  }

  const dialogOptions: Electron.SaveDialogOptions = data.asZip
    ? {
        title: 'Save Package',
        defaultPath: 'layout-package.zip',
        filters: [{ name: 'ZIP Files', extensions: ['zip'] }]
      }
    : {
        title: 'Save Package Folder',
        defaultPath: 'layout-package',
        properties: ['createDirectory'] as any
      }

  const { filePath, canceled } = await dialog.showSaveDialog(mainWindow, dialogOptions)

  if (canceled || !filePath) {
    return { success: false, canceled: true }
  }

  try {
    // Collect unique images
    const images: Array<{ filename: string; data: string }> = []
    const seenFilenames = new Set<string>()

    for (const page of data.pages) {
      for (const cell of page.cells) {
        if (cell.imageData && cell.filename && !seenFilenames.has(cell.filename)) {
          images.push({ filename: cell.filename, data: cell.imageData })
          seenFilenames.add(cell.filename)
        }
      }
    }

    if (data.asZip) {
      // Create ZIP file
      const output = fs.createWriteStream(filePath)
      const archive = archiver('zip', { zlib: { level: 9 } })

      return new Promise((resolve) => {
        output.on('close', () => {
          resolve({ success: true, filePath, fileCount: images.length })
        })

        archive.on('error', (err) => {
          resolve({ success: false, error: String(err) })
        })

        archive.pipe(output)

        // Add images to archive
        for (const img of images) {
          const base64Data = img.data.split(',')[1]
          const buffer = Buffer.from(base64Data, 'base64')
          archive.append(buffer, { name: img.filename })
        }

        // Add layout JSON
        const layoutData = {
          pages: data.pages.map(p => ({
            cells: p.cells.map(c => ({
              filename: c.filename
            }))
          }))
        }
        archive.append(JSON.stringify(layoutData, null, 2), { name: 'layout.json' })

        archive.finalize()
      })
    } else {
      // Create folder with files
      if (!fs.existsSync(filePath)) {
        fs.mkdirSync(filePath, { recursive: true })
      }

      // Save images
      for (const img of images) {
        const base64Data = img.data.split(',')[1]
        const buffer = Buffer.from(base64Data, 'base64')
        fs.writeFileSync(path.join(filePath, img.filename), buffer)
      }

      // Save layout JSON (with just filenames, not image data)
      const layoutData = {
        pages: data.pages.map(p => ({
          cells: p.cells.map(c => ({
            filename: c.filename
          }))
        }))
      }
      fs.writeFileSync(path.join(filePath, 'layout.json'), JSON.stringify(layoutData, null, 2))

      return { success: true, filePath, fileCount: images.length }
    }
  } catch (error) {
    console.error('Error packaging layout:', error)
    return { success: false, error: String(error) }
  }
})
