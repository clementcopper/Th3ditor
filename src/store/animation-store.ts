import { create } from 'zustand'

interface AnimationState {
  playing: boolean
  elapsed: number
  play: () => void
  pause: () => void
  toggle: () => void
  reset: () => void
  setElapsed: (t: number) => void
}

export const useAnimationStore = create<AnimationState>((set) => ({
  playing: true,
  elapsed: 0,
  play: () => set({ playing: true }),
  pause: () => set({ playing: false }),
  toggle: () => set((s) => ({ playing: !s.playing })),
  reset: () => set({ elapsed: 0 }),
  setElapsed: (t) => set({ elapsed: t }),
}))
