type SoundKind = 'stamp' | 'coin' | 'fanfare'

const NOTES: Record<SoundKind, number[]> = {
  stamp: [660, 880],
  coin: [988, 1319],
  fanfare: [523, 659, 784, 1047],
}

let ctx: AudioContext | null = null

export function playSound(kind: SoundKind, enabled: boolean): void {
  if (!enabled) return
  try {
    const ac = (ctx ??= new AudioContext())
    const start = ac.currentTime
    NOTES[kind].forEach((freq, i) => {
      const t = start + i * 0.12
      const osc = ac.createOscillator()
      const gain = ac.createGain()
      osc.type = 'triangle'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0.2, t)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25)
      osc.connect(gain).connect(ac.destination)
      osc.start(t)
      osc.stop(t + 0.3)
    })
  } catch {
    // 音が出せない環境（テストなど）では何もしない
  }
}
