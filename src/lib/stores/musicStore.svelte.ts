import { createContext } from 'svelte'
import { LocalStore } from './localStore.svelte'

/** Soundtrack for the turnir page (string union, no enums). */
export type MusicTrack =
  'wheel' | 'victory' | 'thinking' | 'rickroll' | 'nightsong' | 'deathnote' | 'light' | 'raphael'

const MUSIC_BASE = '/static/media'

export const MUSIC_TRACKS: Record<MusicTrack, { src: string; loop: boolean }> = {
  wheel: { src: `${MUSIC_BASE}/spinner_music.mp3`, loop: true },
  victory: { src: `${MUSIC_BASE}/victory_music.mp3`, loop: true },
  thinking: { src: `${MUSIC_BASE}/thinking_music.mp3`, loop: true },
  rickroll: { src: `${MUSIC_BASE}/rickroll_music.mp3`, loop: true },
  nightsong: { src: `${MUSIC_BASE}/nightsong_music.mp3`, loop: true },
  deathnote: { src: `${MUSIC_BASE}/deathnote_music.mp3`, loop: true },
  light: { src: `${MUSIC_BASE}/light_music.mp3`, loop: true },
  raphael: { src: `${MUSIC_BASE}/raphael_music.mp3`, loop: true },
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
