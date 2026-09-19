import { createContext } from 'svelte'
import { LocalStore } from './localStore.svelte'

/** Soundtrack for the turnir page (string union, no enums). */
export type MusicTrack =
  'wheel' | 'victory' | 'thinking' | 'rickroll' | 'nightsong' | 'deathnote' | 'light' | 'raphael'

export const MUSIC_TRACKS: Record<MusicTrack, { src: string; loop: boolean }> = {
  wheel: { src: '/audio/turnir/spinner_music.mp3', loop: true },
  victory: { src: '/audio/turnir/victory_music.mp3', loop: true },
  thinking: { src: '/audio/turnir/thinking_music.mp3', loop: true },
  rickroll: { src: '/audio/turnir/rickroll_music.mp3', loop: true },
  nightsong: { src: '/audio/turnir/nightsong_music.mp3', loop: true },
  deathnote: { src: '/audio/turnir/deathnote_music.mp3', loop: true },
  light: { src: '/audio/turnir/light_music.mp3', loop: true },
  raphael: { src: '/audio/turnir/raphael_music.mp3', loop: true },
}

export const MUSIC_TRACK_IDS: Record<MusicTrack, string> = {
  wheel: 'turnir-music-wheel',
  victory: 'turnir-music-victory',
  thinking: 'turnir-music-thinking',
  rickroll: 'turnir-music-rickroll',
  nightsong: 'turnir-music-nightsong',
  deathnote: 'turnir-music-deathnote',
  light: 'turnir-music-light',
  raphael: 'turnir-music-raphael',
}

/**
 * Reactive port of MusicContext (state only — the DOM playback lives in
 * MusicAudio.svelte, which mirrors the original MusicMap approach of looking
 * up <audio> elements by id and playing/pausing them).
 */
export class MusicStore {
  volume = new LocalStore<number>('music-volume', 0.5)
  muted = new LocalStore<boolean>('music-muted', false)
  current = $state<MusicTrack | null>(null)

  play(track?: MusicTrack) {
    this.current = track ?? null
  }

  stop() {
    this.current = null
  }

  toggleMute() {
    this.muted.value = !this.muted.value
  }
}

export const [getMusicStore, setMusicStore] = createContext<MusicStore>()
