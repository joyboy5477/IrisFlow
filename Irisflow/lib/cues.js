const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

let cueDir = "";
const files = {};

function writeWav(filePath, samples, sampleRate) {
  const dataSize = samples.length * 2;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);
  for (let i = 0; i < samples.length; i++) {
    const clipped = Math.max(-1, Math.min(1, samples[i]));
    buffer.writeInt16LE(Math.round(clipped * 32767), 44 + i * 2);
  }
  fs.writeFileSync(filePath, buffer);
}

function tone({ freq, durationMs, decay, gain, sampleRate = 22050, slideTo }) {
  const n = Math.floor((sampleRate * durationMs) / 1000);
  const samples = new Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / sampleRate;
    const env = Math.exp(-t * decay);
    const f = slideTo ? freq + (slideTo - freq) * (i / n) : freq;
    samples[i] = Math.sin(2 * Math.PI * f * t) * env * gain;
  }
  return samples;
}

function mix(a, b, offset) {
  const out = a.slice();
  for (let i = 0; i < b.length; i++) {
    const idx = i + offset;
    if (idx >= out.length) out.push(b[i]);
    else out[idx] += b[i];
  }
  return out;
}

function init(userDataPath) {
  cueDir = path.join(userDataPath, "cues");
  fs.mkdirSync(cueDir, { recursive: true });

  const listen = tone({ freq: 1760, durationMs: 70, decay: 38, gain: 0.22 });
  writeWav(path.join(cueDir, "listen.wav"), listen, 22050);

  const success = mix(
    tone({ freq: 880, durationMs: 90, decay: 22, gain: 0.16 }),
    tone({ freq: 1320, durationMs: 110, decay: 18, gain: 0.12 }),
    Math.floor(22050 * 0.04)
  );
  writeWav(path.join(cueDir, "success.wav"), success, 22050);

  const copied = tone({
    freq: 980,
    slideTo: 720,
    durationMs: 120,
    decay: 16,
    gain: 0.14,
  });
  writeWav(path.join(cueDir, "copied.wav"), copied, 22050);

  files.listen = path.join(cueDir, "listen.wav");
  files.success = path.join(cueDir, "success.wav");
  files.copied = path.join(cueDir, "copied.wav");
}

function play(name) {
  const file = files[name];
  if (!file || process.platform !== "darwin") return;
  spawn("afplay", ["-v", "0.28", file], {
    stdio: "ignore",
    detached: true,
  }).unref();
}

module.exports = { init, play };
