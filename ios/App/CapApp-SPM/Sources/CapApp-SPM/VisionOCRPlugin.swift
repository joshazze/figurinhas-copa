import Foundation
import Capacitor
import Vision
import UIKit
import CoreGraphics

// Plugin Capacitor que chama VNRecognizeTextRequest do iOS (Vision Framework).
// Zero download de modelo, executa no Neural Engine, ~0.1-0.3s por pass.
//
// Estrategia multi-pass pra maxima confianca:
//   - 4 passes na imagem inteira (orientacoes up/right/down/left)
//   - 4 passes em quadrantes 60% (TL/TR/BL/BR, overlap 20%)
//   - 4 passes em metades (top/bottom/left/right)
//   Total: 12 passes spatiais. Voting por codigo unico.

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

        let base64: String
        if imageData.hasPrefix("data:") {
            if let commaIdx = imageData.firstIndex(of: ",") {
                base64 = String(imageData[imageData.index(after: commaIdx)...])
            } else { call.reject("data URL invalida"); return }
        } else {
            base64 = imageData
        }

        guard let data = Data(base64Encoded: base64, options: .ignoreUnknownCharacters),
              let image = UIImage(data: data),
              let cgImage = image.cgImage else {
            call.reject("Imagem invalida")
            return
        }

        DispatchQueue.global(qos: .userInitiated).async {
            var allLines: [[String: Any]] = []

            // === Pass FULL: imagem inteira em 4 orientacoes ===
            let fullOrients: [(CGImagePropertyOrientation, String)] = [
                (.up, "full-0°"),
                (.right, "full-90°"),
                (.down, "full-180°"),
                (.left, "full-270°")
            ]
            for (orient, label) in fullOrients {
                let results = self.recognizeText(cgImage: cgImage, orientation: orient)
                for r in results {
                    allLines.append(["text": r.text, "confidence": r.conf, "pass": label])
                }
            }

            // === Pass QUADRANTES: 4 cantos (60% cada, com overlap) ===
            let w = cgImage.width
            let h = cgImage.height
            let qw = Int(Double(w) * 0.6)
            let qh = Int(Double(h) * 0.6)
            let quadrants: [(String, Int, Int)] = [
                ("Q-TL", 0, 0),
                ("Q-TR", w - qw, 0),
                ("Q-BL", 0, h - qh),
                ("Q-BR", w - qw, h - qh)
            ]
            for (label, x, y) in quadrants {
                let rect = CGRect(x: x, y: y, width: qw, height: qh)
                if let cropped = cgImage.cropping(to: rect) {
                    let results = self.recognizeText(cgImage: cropped, orientation: .up)
                    for r in results {
                        allLines.append(["text": r.text, "confidence": r.conf, "pass": label])
                    }
                }
            }

            // === Pass METADES: top/bottom/left/right ===
            let halves: [(String, CGRect)] = [
                ("H-top",    CGRect(x: 0,         y: 0,          width: w,     height: h / 2)),
                ("H-bottom", CGRect(x: 0,         y: h / 2,      width: w,     height: h - h / 2)),
                ("H-left",   CGRect(x: 0,         y: 0,          width: w / 2, height: h)),
                ("H-right",  CGRect(x: w / 2,     y: 0,          width: w - w / 2, height: h))
            ]
            for (label, rect) in halves {
                if let cropped = cgImage.cropping(to: rect) {
                    let results = self.recognizeText(cgImage: cropped, orientation: .up)
                    for r in results {
                        allLines.append(["text": r.text, "confidence": r.conf, "pass": label])
                    }
                }
            }

            DispatchQueue.main.async {
                call.resolve([
                    "engine": "vision",
                    "lines": allLines,
                    "text": allLines.map { $0["text"] as? String ?? "" }.joined(separator: "\n"),
                    "totalPasses": 12
                ])
            }
        }
    }

    private func recognizeText(cgImage: CGImage, orientation: CGImagePropertyOrientation) -> [(text: String, conf: Float)] {
        let request = VNRecognizeTextRequest()
        request.recognitionLevel = .accurate
        request.usesLanguageCorrection = false
        request.minimumTextHeight = 0.005       // texto bem pequeno (badges)
        if #available(iOS 16.0, *) {
            request.automaticallyDetectsLanguage = false
        }
        request.recognitionLanguages = ["en-US"]

        let handler = VNImageRequestHandler(cgImage: cgImage, orientation: orientation, options: [:])
        do {
            try handler.perform([request])
            guard let observations = request.results else { return [] }
            return observations.compactMap { obs in
                guard let best = obs.topCandidates(1).first else { return nil }
                return (best.string, best.confidence)
            }
        } catch {
            return []
        }
    }
}
