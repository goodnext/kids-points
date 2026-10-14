// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from 'vitest'

class FakeAudioContext {
  static instances: FakeAudioContext[] = []
  state = 'suspended'
  currentTime = 0
  destination = {}
  resume = vi.fn(async () => {
    this.state = 'running'
  })
  constructor() {
    FakeAudioContext.instances.push(this)
  }
  createOscillator() {
    return { type: '', frequency: { value: 0 }, connect: (n: unknown) => n, start: vi.fn(), stop: vi.fn() }
  }
  createGain() {
    return { gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }, connect: (n: unknown) => n }
  }
}

beforeEach(() => {
  vi.resetModules()
  FakeAudioContext.instances = []
  vi.stubGlobal('AudioContext', FakeAudioContext)
})

it('最初のタップの中で AudioContext を作って resume する（iPad は タップの中でないと音が出ない）', async () => {
  const { installAudioUnlock } = await import('./sound')
  installAudioUnlock()
  document.dispatchEvent(new Event('pointerdown'))
  expect(FakeAudioContext.instances).toHaveLength(1)
  expect(FakeAudioContext.instances[0].resume).toHaveBeenCalled()
})

it('止まっている AudioContext は、鳴らす前に resume する', async () => {
  const { installAudioUnlock, playSound } = await import('./sound')
  installAudioUnlock()
  document.dispatchEvent(new Event('pointerdown'))
  const ctx = FakeAudioContext.instances[0]
  ctx.state = 'interrupted'
  ctx.resume.mockClear()
  playSound('stamp', true)
  expect(ctx.resume).toHaveBeenCalled()
  expect(FakeAudioContext.instances).toHaveLength(1)
})
