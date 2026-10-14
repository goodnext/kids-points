export function isValidPin(pin: string): boolean {
  return /^\d{4}$/.test(pin)
}

// 子どもが勝手に親の操作をしないための鍵。強固な暗号ではなく FNV-1a で十分とする
export function hashPin(pin: string): string {
  let h = 0x811c9dc5
  for (const ch of `kids-points:${pin}`) {
    h ^= ch.charCodeAt(0)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h.toString(16).padStart(8, '0')
}
