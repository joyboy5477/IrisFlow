export async function requestVoiceAssist({ audioBlob, context }) {
  if (!audioBlob || audioBlob.size === 0) {
    throw new Error("No audio captured");
  }

  const bytes = new Uint8Array(await audioBlob.arrayBuffer());
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }

  return window.iris.processVoice({
    audio: btoa(binary),
    mimeType: audioBlob.type || "audio/webm",
    context: context || "",
  });
}
