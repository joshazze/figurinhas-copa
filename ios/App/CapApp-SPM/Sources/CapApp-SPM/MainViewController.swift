import UIKit
import Capacitor

// Subclasse do CAPBridgeViewController pra registrar plugins customizados.
// Capacitor 8 SPM nao faz auto-discovery de plugins do pacote local, entao
// precisamos da hook capacitorDidLoad() pra registrar manualmente.
//
// Esta classe vive no pacote CapApp-SPM. A storyboard (Main.storyboard) deve
// referenciar `customClass="MainViewController" customModule="CapApp_SPM"`.
@objc(MainViewController)
public class MainViewController: CAPBridgeViewController {
    public override func capacitorDidLoad() {
        bridge?.registerPluginInstance(VisionOCRPlugin())
    }
}
