# Packaging Iris Flow into a DMG

Builds an installable `Irisflow.app` for **Apple Silicon** Macs. No Python backend is required.

The build must run **on a Mac**.

## Recommended: install to Applications

This is the path for people who want to use Iris Flow every day. It builds the app, copies it to `/Applications/Irisflow.app`, then deletes the temporary `release/` folder. After this, open Irisflow from Spotlight or the Dock — no npm command. The only copy you keep is the one in Applications.

```bash
cd Irisflow
npm install
npm run install:mac
```

Then:

1. Finder → Applications → right-click **Irisflow** → **Open** → **Open** (unsigned build).
2. **System Settings → Privacy & Security → Accessibility** → enable **Irisflow**.
3. Allow **Microphone** when prompted.
4. Quit and relaunch Irisflow from Applications, paste a Deepgram key, hold Left-Ctrl to speak.

## Build a DMG to share

Only needed if you want a `.dmg` file to send someone. Everyday use should stay on `npm run install:mac`.

```bash
cd Irisflow
npm install
npm run dist:mac
```

That leaves a `.dmg` under `release/`. Drag **Irisflow** to Applications from it, then you can delete `release/` yourself. If you previously installed **Iris.app** or **Iris Flow.app**, you can delete those old copies.

## Permissions (grant to Irisflow, not Terminal)

- **System Settings → Privacy & Security → Accessibility** → enable **Irisflow**
- Microphone when prompted
- Quit and relaunch Irisflow after granting Accessibility

If you only used `npm start` from Terminal, macOS ties Accessibility to **Terminal**. Installing the `.app` is what makes Irisflow work after you close the terminal.

## Test

1. Launch Irisflow from Applications. Finish the setup sheet and paste a Deepgram key.
2. Dictation: click a text field, hold Left-Ctrl, speak, release → text should appear.
3. AI mode: add a provider key, turn AI mode on, select text, hold Left-Ctrl, speak → answer copied.
4. Activity tab shows errors if something failed.

## Known packaging notes

- Key helper is an **arm64** `MacKeyServer` binary, unpacked from asar so macOS can execute it.
- Gatekeeper may say the app is damaged because it is unsigned. The right-click → Open step above is the workaround. Public distribution later needs Apple signing + notarization.
- Intel Macs are not in this build.
