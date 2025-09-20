// /public/mic-capture.worklet.js
// Captures mic audio in 16 kHz mono, converts to Int16 PCM, and flushes ~20 ms chunks.

class MicCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    // target ~20ms at the actual worklet sampleRate (we create the context at 16k)
    const ms = 20;
    this.samplesPerFlush = Math.max(1, Math.round((sampleRate * ms) / 1000)); // ~320 @ 16k
    this.buff = new Int16Array(0);

    // (optional) allow main thread to update flush size in ms
    this.port.onmessage = (e) => {
      const { type, ms } = e.data || {};
      if (type === 'setFlushMs' && typeof ms === 'number' && ms > 0) {
        this.samplesPerFlush = Math.max(1, Math.round((sampleRate * ms) / 1000));
      }
    };
  }

  static get parameterDescriptors() { return []; }

  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0]) {
      // no mic frames; keep processor alive
      return true;
    }

    // Use first channel. If multi‑channel, downmix by averaging.
    const ch0 = input[0];
    const frames = ch0.length;

    // Convert Float32 [-1,1] → Int16 PCM (little‑endian)
    const i16 = new Int16Array(frames);
    for (let i = 0; i < frames; i++) {
      let s = ch0[i] * 32768;
      // hard clip
      if (s > 32767) s = 32767;
      else if (s < -32768) s = -32768;
      i16[i] = s | 0;
    }

    // Append to rolling buffer
    const merged = new Int16Array(this.buff.length + i16.length);
    merged.set(this.buff, 0);
    merged.set(i16, this.buff.length);
    this.buff = merged;

    // Flush in fixed‑size chunks
    while (this.buff.length >= this.samplesPerFlush) {
      const chunk = this.buff.subarray(0, this.samplesPerFlush);
      // Post raw bytes as Uint8Array (little‑endian)
      const bytes = new Uint8Array(
        chunk.buffer.slice(chunk.byteOffset, chunk.byteOffset + chunk.byteLength)
      );
      this.port.postMessage(bytes);
      this.buff = this.buff.subarray(this.samplesPerFlush);
    }

    return true;
  }
}

registerProcessor('mic-capture', MicCaptureProcessor);
