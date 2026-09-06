import ApplicationServices
import Foundation

private let leftControlKeyCode: Int64 = 59
private var leftControlDown = false
private var eventTap: CFMachPort?

private func writeEvent(name: String, state: String) {
    let line = "{\"name\":\"\(name)\",\"state\":\"\(state)\"}\n"
    if let data = line.data(using: .utf8) {
        FileHandle.standardOutput.write(data)
    }
    fflush(stdout)
}

private func waitForAccessibilityPermission() {
    if AXIsProcessTrusted() {
        return
    }

    fputs("Waiting for Accessibility permission. Enable Irisflow, then this helper will continue.\n", stderr)
    while !AXIsProcessTrusted() {
        Thread.sleep(forTimeInterval: 2.0)
    }
    fputs("Accessibility permission granted. Starting keyboard listener.\n", stderr)
}

private let callback: CGEventTapCallBack = { _, type, event, _ in
    if type == .tapDisabledByTimeout || type == .tapDisabledByUserInput {
        if let eventTap {
            CGEvent.tapEnable(tap: eventTap, enable: true)
        }
        return Unmanaged.passUnretained(event)
    }

    if type == .flagsChanged {
        let keyCode = event.getIntegerValueField(.keyboardEventKeycode)
        if keyCode == leftControlKeyCode {
            let isDown = event.flags.contains(.maskControl)
            if isDown != leftControlDown {
                leftControlDown = isDown
                writeEvent(name: "LEFT CTRL", state: isDown ? "DOWN" : "UP")
            }
        }
    } else if type == .keyDown, leftControlDown {
        writeEvent(name: "OTHER", state: "DOWN")
    }

    return Unmanaged.passUnretained(event)
}

let eventMask =
    (1 << CGEventType.flagsChanged.rawValue) |
    (1 << CGEventType.keyDown.rawValue)

waitForAccessibilityPermission()

eventTap = CGEvent.tapCreate(
    tap: .cgSessionEventTap,
    place: .headInsertEventTap,
    options: .defaultTap,
    eventsOfInterest: CGEventMask(eventMask),
    callback: callback,
    userInfo: nil
)

guard let eventTap else {
    fputs("Unable to create keyboard event tap. Grant Irisflow Accessibility permission and restart.\n", stderr)
    exit(2)
}

let runLoopSource = CFMachPortCreateRunLoopSource(kCFAllocatorDefault, eventTap, 0)
CFRunLoopAddSource(CFRunLoopGetCurrent(), runLoopSource, .commonModes)
CGEvent.tapEnable(tap: eventTap, enable: true)
CFRunLoopRun()
