import Foundation
import UIKit
import MLImage

public func getImageFaceFromBuffer(from sampleBuffer: CMSampleBuffer?, rectImage: CGRect) -> UIImage? {
    guard let sampleBuffer = sampleBuffer else {
        print("Sample buffer is NULL.")
        return nil
    }
    guard let imageBuffer = CMSampleBufferGetImageBuffer(sampleBuffer) else {
        print("Invalid sample buffer.")
        return nil
    }
    let ciimage = CIImage(cvPixelBuffer: imageBuffer)
    let context = CIContext(options: nil)
    let cgImage = context.createCGImage(ciimage, from: ciimage.extent)!
    
    if (!rectImage.isNull) {
        let imageRef: CGImage = cgImage.cropping(to: rectImage)!
        let imageCrop: UIImage = UIImage(cgImage: imageRef, scale: 0.5, orientation: .up)
        return imageCrop
    } else {
        return nil
    }
}

public func getImageFaceFromUIImage(from image: UIImage, rectImage: CGRect) -> UIImage? {
    let imageRef: CGImage = (image.cgImage?.cropping(to: rectImage)!)!
    let imageCrop: UIImage = UIImage(cgImage: imageRef, scale: 0.5, orientation: image.imageOrientation)
    return imageCrop
}

public func convertImageToBase64(image: UIImage) -> String {
    let imageData = image.pngData()!
    return imageData.base64EncodedString()
}

public func convertBase64ToImage(strBase64: String) -> UIImage? {
    let dataDecoded : Data = Data(base64Encoded: strBase64, options: .ignoreUnknownCharacters)!
    return UIImage(data: dataDecoded)
}

public func uiImageToPixelBuffer(image: UIImage, size: Int) -> CVPixelBuffer? {
    let attrs = [kCVPixelBufferCGImageCompatibilityKey: kCFBooleanTrue, kCVPixelBufferCGBitmapContextCompatibilityKey: kCFBooleanTrue] as CFDictionary
    var pixelBuffer : CVPixelBuffer?
    let status = CVPixelBufferCreate(kCFAllocatorDefault, size, size, kCVPixelFormatType_32ARGB, attrs, &pixelBuffer)
    guard (status == kCVReturnSuccess) else {
        return nil
    }
    
    CVPixelBufferLockBaseAddress(pixelBuffer!, CVPixelBufferLockFlags(rawValue: 0))
    let pixelData = CVPixelBufferGetBaseAddress(pixelBuffer!)
    
    let rgbColorSpace = CGColorSpaceCreateDeviceRGB()
    let context = CGContext(data: pixelData, width: size, height: size, bitsPerComponent: 8, bytesPerRow: CVPixelBufferGetBytesPerRow(pixelBuffer!), space: rgbColorSpace, bitmapInfo: CGImageAlphaInfo.noneSkipFirst.rawValue)
    
    context?.translateBy(x: 0, y: CGFloat(size))
    context?.scaleBy(x: 1.0, y: -1.0)
    
    UIGraphicsPushContext(context!)
    image.draw(in: CGRect(x: 0, y: 0, width: size, height: size))
    UIGraphicsPopContext()
    CVPixelBufferUnlockBaseAddress(pixelBuffer!, CVPixelBufferLockFlags(rawValue: 0))
    return pixelBuffer
}
