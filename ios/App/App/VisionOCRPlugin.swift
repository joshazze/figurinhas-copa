import Foundation
import Capacitor
import Vision
import UIKit

// Plugin Capacitor que chama VNRecognizeTextRequest do iOS (Vision Framework).
// Zero download de modelo, executa no Neural Engine, ~0.3s por foto, 95%+
// acuracia em texto impresso.
//
// Uso no JS:
//   import { registerPlugin } from '@capacitor/core';
//   const VisionOCR = registerPlugin('VisionOCR');
//   const res = await VisionOCR.recognize({ imageData: 'data:image/jpeg;base64,...' });

@objc(VisionOCRPlugin)
public class VisionOCRPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "VisionOCRPlugin"
    public let jsName = "VisionOCR"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "recognize", returnType: CAPPluginReturnPromise)
    ]

    @objc func recognize(_ call: CAPPluginCall) {
        guard let imageData = call.getString("imageData") else {
            call.reject("imageData (string base64) e obrigatorio")
            return
        }

        // Aceita "data:image/...;base64,XXX" OU base64 puro
        let base64: String
        if imageData.hasPrefix("data:") {
            if let commaIdx = imageData.firstIndex(of: ",") {
                base64 = String(imageData[imageData.index(after: commaIdx)...])
            } else {
                call.reject("data URL invalida")
                return
            }
        } else {
            base64 = imageData
        }

        guard let data = Data(base64Encoded: base64, options: .ignoreUnknownCharacters),
              let image = UIImage(data: data),
              let cgImage = image.cgImage else {
            call.reject("Imagem invalida")
            return
        }

        // PaddleOCR/Tesseract tinham fluxo de 'multi rotation'. Vision faz isso
        // automaticamente quando configurado com `automaticallyDetectsLanguage = false`
        // e `recognitionLevel = .accurate`. Mas pra garantir, rodamos em 4 orientacoes
        // sequenciais aqui dentro do plugin nativo (rapido em Swift).
        let orientations: [CGImagePropertyOrientation] = [.up, .right, .down, .left]

        DispatchQueue.global(qos: .userInitiated).async {
            var allLines: [[String: Any]] = []
            for orientation in orientations {
                let request = VNRecognizeTextRequest()
                request.recognitionLevel = .accurate
                request.usesLanguageCorrection = false   // codigos nao sao palavras
                request.minimumTextHeight = 0.01         // pega texto pequeno (badges)
                if #available(iOS 16.0, *) {
                    request.automaticallyDetectsLanguage = false
                }
                request.recognitionLanguages = ["en-US"]

                let handler = VNImageRequestHandler(cgImage: cgImage, orientation: orientation, options: [:])
                do {
                    try handler.perform([request])
                    guard let observations = request.results else { continue }
                    let orientLabel: String
                    switch orientation {
                    case .up: orientLabel = "0°"
                    case .right: orientLabel = "90°"
                    case .down: orientLabel = "180°"
                    case .left: orientLabel = "270°"
                    default: orientLabel = "?"
                    }
                    for obs in observations {
                        guard let best = obs.topCandidates(1).first else { continue }
                        allLines.append([
                            "text": best.string,
                            "confidence": best.confidence,
                            "pass": orientLabel
                        ])
                    }
                } catch {
                    // ignora pass que falhou, continua
                }
            }

            DispatchQueue.main.async {
                call.resolve([
                    "engine": "vision",
                    "lines": allLines,
                    "text": allLines.map { $0["text"] as? String ?? "" }.joined(separator: "\n")
                ])
            }
        }
    }
}
