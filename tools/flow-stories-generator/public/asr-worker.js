// Web Worker de transcripcion: Whisper (Transformers.js) ejecutado en el
// navegador. El audio nunca sale del equipo del usuario.
import {
  pipeline,
  env,
} from "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.1/dist/transformers.min.js";

env.allowLocalModels = false;

const SAMPLE_RATE = 16000;
const SEGMENT_S = 120;
let asr = null;
let asrModel = null;

async function hasWebGPU() {
  try {
    return !!(navigator.gpu && (await navigator.gpu.requestAdapter()));
  } catch {
    return false;
  }
}

async function getPipeline(model) {
  if (asr && asrModel === model) return asr;
  const files = {};
  const webgpu = await hasWebGPU();
  asr = await pipeline("automatic-speech-recognition", model, {
    device: webgpu ? "webgpu" : "wasm",
    dtype: webgpu
      ? { encoder_model: "fp32", decoder_model_merged: "q4" }
      : "q8",
    progress_callback: (p) => {
      if (p.status === "progress" && p.file) {
        files[p.file] = { loaded: p.loaded || 0, total: p.total || 0 };
        const loaded = Object.values(files).reduce((a, f) => a + f.loaded, 0);
        const total = Object.values(files).reduce((a, f) => a + f.total, 0);
        self.postMessage({
          type: "model-progress",
          loaded,
          total,
        });
      }
    },
  });
  asrModel = model;
  self.postMessage({ type: "model-ready", device: webgpu ? "webgpu" : "wasm" });
  return asr;
}

self.onmessage = async (e) => {
  const { audio, model, language } = e.data;
  try {
    const run = await getPipeline(model);
    const seg = SEGMENT_S * SAMPLE_RATE;
    const total = Math.max(1, Math.ceil(audio.length / seg));
    const texts = [];
    for (let i = 0; i < total; i++) {
      const chunk = audio.subarray(i * seg, Math.min(audio.length, (i + 1) * seg));
      const out = await run(chunk, {
        language,
        task: "transcribe",
        chunk_length_s: 30,
        stride_length_s: 5,
      });
      const text = (Array.isArray(out) ? out.map((o) => o.text).join(" ") : out.text || "").trim();
      if (text) texts.push(text);
      self.postMessage({
        type: "partial",
        done: i + 1,
        total,
        text: texts.join("\n"),
      });
    }
    self.postMessage({ type: "done", text: texts.join("\n") });
  } catch (err) {
    self.postMessage({ type: "error", message: String((err && err.message) || err) });
  }
};
