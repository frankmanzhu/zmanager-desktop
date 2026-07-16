import AppKit
import Foundation

private struct IconRequest: Decodable {
    let key: String
    let path: String
    let isDirectory: Bool
}

private struct IconResponse: Encodable {
    let key: String
    let dataUrl: String?
}

private final class OperationResult: @unchecked Sendable {
    var data = Data()
}

private func pngDataURL(for path: String, isDirectory: Bool) -> String? {
    let lookupPath = path.isEmpty && isDirectory ? "/" : path
    guard !lookupPath.isEmpty else { return nil }
    let image = NSWorkspace.shared.icon(forFile: lookupPath)
    image.size = NSSize(width: 32, height: 32)
    guard let tiff = image.tiffRepresentation,
          let bitmap = NSBitmapImageRep(data: tiff),
          let png = bitmap.representation(using: .png, properties: [:])
    else { return nil }
    return "data:image/png;base64,\(png.base64EncodedString())"
}

@_cdecl("zmanager_macos_system_file_icons")
public func zmanagerMacOSSystemFileIcons(
    _ bytes: UnsafePointer<UInt8>?,
    _ count: Int,
    _ callback: ZManagerHostCallback?,
    _ context: UnsafeMutableRawPointer?
) -> Int32 {
    guard let bytes, count >= 0, count <= 1_048_576, let callback else { return 1 }
    let input = Data(bytes: bytes, count: count)
    guard let requests = try? JSONDecoder().decode([IconRequest].self, from: input),
          requests.count <= 1_024
    else { return 2 }
    let result = OperationResult()
    let work = {
        let responses = requests.map {
            IconResponse(key: $0.key, dataUrl: pngDataURL(for: $0.path, isDirectory: $0.isDirectory))
        }
        result.data = (try? JSONEncoder().encode(responses)) ?? Data("[]".utf8)
    }
    if Thread.isMainThread { work() } else { DispatchQueue.main.sync(execute: work) }
    result.data.withUnsafeBytes { output in
        callback(output.bindMemory(to: UInt8.self).baseAddress, output.count, context)
    }
    return 0
}
