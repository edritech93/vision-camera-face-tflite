import Foundation
import VisionCamera
import MLKitFaceDetection
import MLKitVision
import CoreML
import UIKit
import TensorFlowLite
import Accelerate
import AVKit
import Vision

@objc(VisionCameraFaceTfliteModule)
class VisionCameraFaceTfliteModule: NSObject {
    
    static var FaceDetectorOption: FaceDetectorOptions = {
        let option = FaceDetectorOptions()
        option.performanceMode = .accurate
        return option
    }()
    
    static var faceDetector = FaceDetector.faceDetector(options: FaceDetectorOption)
    
    @objc(detectFromBase64:withResolver:withRejecter:)
    func detectFromBase64(imageString: String, resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) -> Void {
        let stringData = Data(base64Encoded: imageString) ?? nil
        let uiImage = UIImage(data: stringData!)
        
        if (uiImage != nil) {
            let image = VisionImage(image: uiImage!)
            do {
                let faces: [Face] =  try VisionCameraFaceTfliteModule.faceDetector.results(in: image)
                if (!faces.isEmpty){
                    for face in faces {
                        let faceFrame = face.frame
                        let imageCrop = getImageFaceFromUIImage(from: uiImage!, rectImage: faceFrame)
                        resolve(convertImageToBase64(image:imageCrop!))
                        return
                    }
                } else {
                    resolve("")
                }
            } catch {
                reject("Error", error.localizedDescription, error)
            }
        }
    }

    @objc(initTensor:withCount:withResolver:withRejecter:)
    func initTensor(modelName: String, count: Int = 1, resolve:RCTPromiseResolveBlock,reject:RCTPromiseRejectBlock) -> Void {
        // Construct the path to the model file.
        guard let modelPath = Bundle.main.path(
            forResource: modelName,
            ofType: "tflite"
        ) else {
            print("Failed to load the model file with name: \(modelName).")
            return
        }
        do {
            var options = Interpreter.Options()
            options.threadCount = count
            interpreter = try Interpreter(modelPath: modelPath, options: options)
            try interpreter?.allocateTensors()
            resolve("initialization tflite success")
        } catch let error {
            print("Failed to create the interpreter with error: \(error.localizedDescription)")
            reject("Error", "tflite error", error)
            return
        }
    }
    
    @objc(tensorBase64:withResolver:withRejecter:)
    func tensorBase64(imageString: String, resolve:RCTPromiseResolveBlock,reject:RCTPromiseRejectBlock) -> Void {
        let stringData = Data(base64Encoded: imageString)
        guard let image = UIImage(data: stringData!) else {
            reject("Failed to get pixelBuffer", nil, nil)
            return
        }
        guard let pixelBuffer = uiImageToPixelBuffer(image: image, size: inputWidth) else {
            reject("Failed to get pixelBuffer", nil, nil)
            return
        }
        do {
            let inputTensor = try interpreter?.input(at: 0)
            // Remove the alpha component from the image buffer to get the RGB data.
            guard let rgbData = rgbDataFromBuffer(
                pixelBuffer,
                byteCount: batchSize * inputWidth * inputHeight * inputChannels,
                isModelQuantized: inputTensor?.dataType == .uInt8
            ) else {
                reject("Failed to convert the image buffer to RGB data.", nil, nil)
                return
            }
            // Copy the RGB data to the input `Tensor`.
            try interpreter?.copy(rgbData, toInputAt: 0)
            // Run inference by invoking the `Interpreter`.
            try interpreter?.invoke()
            // Get the output `Tensor` to process the inference results.
            let outputTensor: Tensor? = try interpreter?.output(at: 0)
            if ((outputTensor?.data) != nil) {
                let result: [Float] = [Float32](unsafeData: outputTensor!.data) ?? []
                resolve(result)
            } else {
                resolve([])
            }
        } catch let error {
            reject("Failed to invoke the interpreter with error: \(error.localizedDescription)", nil, nil)
        }
    }
}
