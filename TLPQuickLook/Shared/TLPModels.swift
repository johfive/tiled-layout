import Foundation

// MARK: - Page Size

enum TLPPageSize: String, Codable {
    case A4
    case A3

    /// Page dimensions in points (1mm = 2.834645669 pt)
    var sizeInPoints: CGSize {
        let mmToPoints: CGFloat = 2.834645669
        switch self {
        case .A4: return CGSize(width: 210 * mmToPoints, height: 297 * mmToPoints)
        case .A3: return CGSize(width: 297 * mmToPoints, height: 420 * mmToPoints)
        }
    }
}

// MARK: - Cell Content (in .tlp files, imageData is replaced by imageRef)

struct TLPCellContent: Codable {
    let filename: String?
    let originalPath: String?
    let imageRef: String?  // e.g. "image_0.png" — references images/ in ZIP
}

// MARK: - Cell

struct TLPCell: Codable {
    let id: String
    let content: TLPCellContent?
}

// MARK: - Grid Settings

struct TLPGridSettings: Codable {
    let rows: Int
    let cols: Int
    let gap: CGFloat
    let margin: CGFloat
}

// MARK: - Page

struct TLPPage: Codable {
    let id: String
    let cells: [TLPCell]
    let gridSettings: TLPGridSettings
    let hiddenContent: [TLPCellContent]?
}

// MARK: - Layout (top-level layout.json)

struct TLPLayout: Codable {
    let pageSize: TLPPageSize
    let pages: [TLPPage]
    let showFilenames: Bool?
    let showGridLines: Bool?
    let showPageNumbers: Bool?
    let title: String?
}
