// /public/pcm-player.worklet.js
/* global registerProcessor, AudioWorkletProcessor */

class GrowRing {
  constructor(capacity, maxCapacity) {
    this.maxCapacity = maxCapacity;
    this.buf = new Float32Array(capacity);
    this.cap = capacity;
    this.read = 0;
    this.write = 0;
    this.size = 0;
  }
  _grow(minExtra) {
    // Grow to the next power-of-two-ish that fits current + incoming + safety
    const need = this.size + minExtra;
    let next = this.cap;
    while (next < need && next < this.maxCapacity) next <<= 1;
    if (next <= this.cap) return false; // can't grow
    const nb = new Float32Array(next);
    // copy existing data [read .. read+size) into start of new buffer
    const first = Math.min(this.size, this.cap - this.read);
    nb.set(this.buf.subarray(this.read, this.read + first), 0);
    if (this.size > first) nb.set(this.buf.subarray(0, this.size - first), first);
    this.buf = nb;
    this.cap = next;
    this.read = 0;
    this.write = this.size;
    return true;
  }
  push(src) {
    const incoming = src.length;
    // If not enough room, try to grow (up to max)
    if (this.size + incoming > this.cap) {
      this._grow(incoming + 1024); // small slack
    }
    // If still no room after grow, drop **newest** tail (keep the beginning)
    let canWrite = Math.min(incoming, Math.max(0, this.cap - this.size));
    if (canWrite < incoming) {
      // write only last 'canWrite' samples to keep continuity
      src = src.subarray(incoming - canWrite);
    }
    if (canWrite === 0) return;

    const first = Math.min(canWrite, this.cap - this.write);
    this.buf.set(src.subarray(0, first), this.write);
    const remain = canWrite - first;
    if (remain > 0) this.buf.set(src.subarray(first), 0);
    this.write = (this.write + canWrite) % this.cap;
    this.size += canWrite;
  }
  pop(out) {
    const n = out.length;
    if (this.size === 0) { out.fill(0); return; }
    const toRead = Math.min(n, this.size);
    const first = Math.min(toRead, this.cap - this.read);
    out.set(this.buf.subarray(this.read, this.read + first), 0);
    const remain = toRead - first;
    if (remain > 0) out.set(this.buf.subarray(0, remain), first);
    this.read = (this.read + toRead) % this.cap;
    this.size -= toRead;
    if (toRead < n) out.fill(0, toRead); // pad with silence
  }
}

class PCMPlayerProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    const sr = sampleRate || 24000;
    const initialSeconds = 3;   // start with ~3s
    const maxSeconds = 60;      // allow up to ~60s buffering
    this.queue = new GrowRing(sr * initialSeconds, sr * maxSeconds);

    this.port.onmessage = (e) => {
      const { type, samples } = e.data || {};
      if (type === 'pcm' && samples && samples.length) {
        // samples must be Float32Array in [-1, 1]
        this.queue.push(samples);
      }
    };
  }

  process(_inputs, outputs) {
    const out = outputs[0];
    const ch0 = out[0];

    // Always output exactly the render quantum (128 samples) per tick
    this.queue.pop(ch0);

    // mono → copy to other channels if any
    for (let c = 1; c < out.length; c++) out[c].set(ch0);
    return true;
  }
}

registerProcessor('pcm-player', PCMPlayerProcessor);
