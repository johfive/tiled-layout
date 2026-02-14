import Foundation
import CoreGraphics
import AppKit
import CoreText
import ZIPFoundation

/// Renders page 1 of a TLP layout to a CGImage using CoreGraphics
struct TLPRenderer {

    /// Render page 1 of the layout at the given size
    /// - Parameters:
    ///   - file: Parsed TLP file
    ///   - maxSize: Maximum output size (aspect ratio preserved)
    /// - Returns: Rendered CGImage
    static func render(file: TLPFileReader.TLPFile, maxSize: CGSize) -> CGImage? {
        guard let firstPage = file.layout.pages.first else { return nil }

        let pagePoints = file.layout.pageSize.sizeInPoints
        let mmToPoints: CGFloat = 2.834645669

        // Scale to fit within maxSize while preserving aspect ratio
        let scaleX = maxSize.width / pagePoints.width
        let scaleY = maxSize.height / pagePoints.height
        let scale = min(scaleX, scaleY)

        let outputWidth = Int(pagePoints.width * scale)
        let outputHeight = Int(pagePoints.height * scale)

        guard outputWidth > 0, outputHeight > 0 else { return nil }

        let colorSpace = CGColorSpaceCreateDeviceRGB()
        guard let ctx = CGContext(
            data: nil,
            width: outputWidth,
            height: outputHeight,
            bitsPerComponent: 8,
            bytesPerRow: 0,
            space: colorSpace,
            bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
        ) else { return nil }

        // Flip coordinate system (CG is bottom-up, we want top-down)
        ctx.translateBy(x: 0, y: CGFloat(outputHeight))
        ctx.scaleBy(x: scale, y: -scale)

        // White background
        ctx.setFillColor(CGColor(red: 1, green: 1, blue: 1, alpha: 1))
        ctx.fill(CGRect(x: 0, y: 0, width: pagePoints.width, height: pagePoints.height))

        // Draw title at top if present
        let title = file.layout.title ?? ""
        if !title.isEmpty {
            drawCenteredText(ctx: ctx, text: title, y: 15, pageWidth: pagePoints.width,
                             fontSize: 10, fontName: "Helvetica", color: NSColor(red: 0.4, green: 0.4, blue: 0.4, alpha: 1.0))
        }

        // Draw page number at bottom if enabled
        let showPageNumbers = file.layout.showPageNumbers ?? false
        let totalPages = file.layout.pages.count
        if showPageNumbers {
            let pageNumText = "1/\(totalPages)"
            drawCenteredText(ctx: ctx, text: pageNumText, y: pagePoints.height - 20, pageWidth: pagePoints.width,
                             fontSize: 10, fontName: "Menlo", color: NSColor(red: 0.4, green: 0.4, blue: 0.4, alpha: 1.0))
        }

        // Grid calculations (same math as Electron PDF export)
        let gridSettings = firstPage.gridSettings
        let rows = gridSettings.rows
        let cols = gridSettings.cols
        let marginPts = gridSettings.margin * mmToPoints
        let gapPts = gridSettings.gap * mmToPoints

        let contentWidth = pagePoints.width - (2 * marginPts)
        let contentHeight = pagePoints.height - (2 * marginPts)

        let cellWidth = (contentWidth - (gapPts * CGFloat(cols - 1))) / CGFloat(cols)
        let cellHeight = (contentHeight - (gapPts * CGFloat(rows - 1))) / CGFloat(rows)

        let showFilenames = file.layout.showFilenames ?? false
        let showGridLines = file.layout.showGridLines ?? true

        // Match PDF export: 12pt filename area
        let filenameAreaHeight: CGFloat = showFilenames ? 12.0 : 0

        // Draw each cell
        for (i, cell) in firstPage.cells.enumerated() {
            let row = i / cols
            let col = i % cols

            guard row < rows else { break }

            let cellX = marginPts + CGFloat(col) * (cellWidth + gapPts)
            let cellY = marginPts + CGFloat(row) * (cellHeight + gapPts)
            let cellRect = CGRect(x: cellX, y: cellY, width: cellWidth, height: cellHeight)

            if let content = cell.content, let imageRef = content.imageRef {
                // Calculate image area (leave room for filename if showing)
                let imageRect = CGRect(
                    x: cellRect.origin.x,
                    y: cellRect.origin.y,
                    width: cellRect.width,
                    height: cellRect.height - filenameAreaHeight
                )

                // Extract image at the target cell pixel size for crisp rendering
                let targetPixelSize = CGSize(
                    width: imageRect.width * scale,
                    height: imageRect.height * scale
                )
                if let cgImage = TLPFileReader.extractImage(
                    from: file.archive,
                    imageRef: imageRef,
                    targetSize: targetPixelSize
                ) {
                    drawImageAspectFit(ctx: ctx, image: cgImage, rect: imageRect)
                }

                // Draw filename below the image
                if showFilenames, let filename = content.filename {
                    let filenameY = cellRect.origin.y + cellRect.height - filenameAreaHeight + 2
                    drawFilename(ctx: ctx, text: filename, x: cellRect.origin.x, y: filenameY,
                                 width: cellRect.width, fontSize: 8)
                }
            } else {
                // Draw dashed border for empty cells (only if grid lines enabled)
                if showGridLines {
                    drawEmptyCellBorder(ctx: ctx, rect: cellRect)
                }
            }
        }

        // Fill remaining grid positions with empty borders if cells array is shorter
        let totalCells = rows * cols
        if firstPage.cells.count < totalCells && showGridLines {
            for i in firstPage.cells.count..<totalCells {
                let row = i / cols
                let col = i % cols
                let cellX = marginPts + CGFloat(col) * (cellWidth + gapPts)
                let cellY = marginPts + CGFloat(row) * (cellHeight + gapPts)
                let cellRect = CGRect(x: cellX, y: cellY, width: cellWidth, height: cellHeight)
                drawEmptyCellBorder(ctx: ctx, rect: cellRect)
            }
        }

        return ctx.makeImage()
    }

    // MARK: - Private Helpers

    private static func drawImageAspectFit(ctx: CGContext, image: CGImage, rect: CGRect) {
        let imgWidth = CGFloat(image.width)
        let imgHeight = CGFloat(image.height)

        guard imgWidth > 0, imgHeight > 0 else { return }

        let imgAspect = imgWidth / imgHeight
        let cellAspect = rect.width / rect.height

        var drawWidth: CGFloat
        var drawHeight: CGFloat

        if imgAspect > cellAspect {
            drawWidth = rect.width
            drawHeight = rect.width / imgAspect
        } else {
            drawHeight = rect.height
            drawWidth = rect.height * imgAspect
        }

        let drawX = rect.origin.x + (rect.width - drawWidth) / 2
        let drawY = rect.origin.y + (rect.height - drawHeight) / 2

        let drawRect = CGRect(x: drawX, y: drawY, width: drawWidth, height: drawHeight)

        // CGContext draws images bottom-up by default, but we already flipped.
        // However, drawImage un-flips, so we need to locally flip again for images.
        ctx.saveGState()
        ctx.translateBy(x: drawRect.origin.x, y: drawRect.origin.y + drawRect.height)
        ctx.scaleBy(x: 1, y: -1)
        ctx.draw(image, in: CGRect(x: 0, y: 0, width: drawRect.width, height: drawRect.height))
        ctx.restoreGState()
    }

    private static func drawEmptyCellBorder(ctx: CGContext, rect: CGRect) {
        ctx.saveGState()
        // Match web app's #e5e5e5 grid line color
        ctx.setStrokeColor(CGColor(red: 0.898, green: 0.898, blue: 0.898, alpha: 1.0))
        ctx.setLineWidth(0.75)
        ctx.setLineDash(phase: 0, lengths: [4, 4])
        ctx.stroke(rect)
        ctx.restoreGState()
    }

    /// Draw text centered horizontally on the page (for title, page numbers)
    private static func drawCenteredText(ctx: CGContext, text: String, y: CGFloat, pageWidth: CGFloat,
                                          fontSize: CGFloat, fontName: String, color: NSColor) {
        ctx.saveGState()

        let nsCtx = NSGraphicsContext(cgContext: ctx, flipped: true)
        NSGraphicsContext.saveGraphicsState()
        NSGraphicsContext.current = nsCtx

        let paragraphStyle = NSMutableParagraphStyle()
        paragraphStyle.alignment = .center

        let attributes: [NSAttributedString.Key: Any] = [
            .font: NSFont(name: fontName, size: fontSize) ?? NSFont.systemFont(ofSize: fontSize),
            .foregroundColor: color,
            .paragraphStyle: paragraphStyle
        ]

        let drawRect = NSRect(x: 0, y: y, width: pageWidth, height: fontSize + 4)
        (text as NSString).draw(in: drawRect, withAttributes: attributes)

        NSGraphicsContext.restoreGraphicsState()
        ctx.restoreGState()
    }

    /// Draw filename text centered within a cell width, with truncation and clipping
    private static func drawFilename(ctx: CGContext, text: String, x: CGFloat, y: CGFloat,
                                      width: CGFloat, fontSize: CGFloat) {
        ctx.saveGState()

        // Clip to cell bounds so text never overflows
        ctx.clip(to: CGRect(x: x, y: y, width: width, height: fontSize + 4))

        // Use NSGraphicsContext so NSString.draw works in our CGContext
        let nsCtx = NSGraphicsContext(cgContext: ctx, flipped: true)
        NSGraphicsContext.saveGraphicsState()
        NSGraphicsContext.current = nsCtx

        let paragraphStyle = NSMutableParagraphStyle()
        paragraphStyle.alignment = .center
        paragraphStyle.lineBreakMode = .byTruncatingTail

        let attributes: [NSAttributedString.Key: Any] = [
            .font: NSFont(name: "Menlo", size: fontSize) ?? NSFont.systemFont(ofSize: fontSize),
            .foregroundColor: NSColor(red: 0.3, green: 0.3, blue: 0.3, alpha: 1.0),
            .paragraphStyle: paragraphStyle
        ]

        let drawRect = NSRect(x: x, y: y, width: width, height: fontSize + 4)
        (text as NSString).draw(in: drawRect, withAttributes: attributes)

        NSGraphicsContext.restoreGraphicsState()
        ctx.restoreGState()
    }
}
