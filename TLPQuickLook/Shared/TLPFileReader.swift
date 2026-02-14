import Foundation
import ZIPFoundation

/// Reads .tlp files (ZIP archives containing layout.json + images/)
struct TLPFileReader {

    /// Parsed result from a .tlp file
    struct TLPFile {
        let layout: TLPLayout
        let archive: Archive
    }

    /// Open and parse a .tlp file at the given URL
    static func read(url: URL) throws -> TLPFile {
        guard let archive = Archive(url: url, accessMode: .read) else {
            throw TLPError.cannotOpenArchive
        }

        // Find and parse layout.json
        guard let layoutEntry = archive["layout.json"] else {
            throw TLPError.missingLayoutJSON
        }

        var layoutData = Data()
        _ = try archive.extract(layoutEntry) { data in
            layoutData.append(data)
        }

        let decoder = JSONDecoder()
        let layout = try decoder.decode(TLPLayout.self, from: layoutData)

        return TLPFile(layout: layout, archive: archive)
    }

    /// Extract an image from the ZIP by its imageRef (e.g. "image_0.png")
    /// - Parameters:
    ///   - archive: The ZIP archive
    ///   - imageRef: The image reference path (e.g. "image_0.svg")
    ///   - targetSize: Optional target size for rasterizing vector images (SVG)
    static func extractImage(from archive: Archive, imageRef: String, targetSize: CGSize? = nil) -> CGImage? {
        let entryPath = "images/\(imageRef)"
        guard let entry = archive[entryPath] else { return nil }

        var imageData = Data()
        do {
            _ = try archive.extract(entry) { data in
                imageData.append(data)
            }
        } catch {
            return nil
        }

        // Use NSImage to handle PNG, JPEG, SVG, etc.
        guard let nsImage = NSImage(data: imageData) else { return nil }

        // For SVGs and other vector formats, render at target size for crisp output
        if let targetSize = targetSize, targetSize.width > 0, targetSize.height > 0 {
            let imgSize = nsImage.size
            guard imgSize.width > 0, imgSize.height > 0 else { return nil }

            // Calculate aspect-fit size within targetSize
            let imgAspect = imgSize.width / imgSize.height
            let targetAspect = targetSize.width / targetSize.height
            let renderWidth: CGFloat
            let renderHeight: CGFloat
            if imgAspect > targetAspect {
                renderWidth = targetSize.width
                renderHeight = targetSize.width / imgAspect
            } else {
                renderHeight = targetSize.height
                renderWidth = targetSize.height * imgAspect
            }

            // Rasterize at the calculated size
            let bitmapRep = NSBitmapImageRep(
                bitmapDataPlanes: nil,
                pixelsWide: Int(renderWidth),
                pixelsHigh: Int(renderHeight),
                bitsPerSample: 8,
                samplesPerPixel: 4,
                hasAlpha: true,
                isPlanar: false,
                colorSpaceName: .deviceRGB,
                bytesPerRow: 0,
                bitsPerPixel: 0
            )
            guard let rep = bitmapRep else { return nil }

            rep.size = NSSize(width: renderWidth, height: renderHeight)
            NSGraphicsContext.saveGraphicsState()
            NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)
            nsImage.draw(
                in: NSRect(x: 0, y: 0, width: renderWidth, height: renderHeight),
                from: .zero,
                operation: .copy,
                fraction: 1.0
            )
            NSGraphicsContext.restoreGraphicsState()
            return rep.cgImage
        }

        // Fallback: convert directly
        var proposedRect = NSRect(origin: .zero, size: nsImage.size)
        guard let cgImage = nsImage.cgImage(forProposedRect: &proposedRect, context: nil, hints: nil) else {
            return nil
        }
        return cgImage
    }
}

// MARK: - Errors

enum TLPError: Error, LocalizedError {
    case cannotOpenArchive
    case missingLayoutJSON

    var errorDescription: String? {
        switch self {
        case .cannotOpenArchive: return "Cannot open .tlp archive"
        case .missingLayoutJSON: return "Missing layout.json in archive"
        }
    }
}

// MARK: - NSImage CGImage helper

import AppKit

extension NSImage {
    /// Convert NSImage to CGImage
    func cgImageRepresentation() -> CGImage? {
        cgImage(forProposedRect: nil, context: nil, hints: nil)
    }
}
