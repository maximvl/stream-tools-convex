<script lang="ts">
  import {
    getMusicStore,
    MUSIC_TRACKS,
    MUSIC_TRACK_IDS,
    type MusicTrack,
  } from '$lib/stores/musicStore.svelte'
  import { untrack } from 'svelte'

  const store = getMusicStore()

  const tracks = Object.keys(MUSIC_TRACKS) as MusicTrack[]

  function elementFor(track: MusicTrack): HTMLAudioElement | null {
    return document.getElementById(MUSIC_TRACK_IDS[track]) as HTMLAudioElement | null
  }

  // Track switching only. Volume/mute are read untracked so moving the
  // slider never restarts the song. Missing files degrade gracefully:
  // play() rejections (404, autoplay policy) are swallowed, no state change.
  $effect(() => {
    const current = store.current
    const { volume, muted } = untrack(() => ({
      volume: store.volume.value,
      muted: store.muted.value,
    }))
    for (const track of tracks) {
      const el = elementFor(track)
      if (!el) continue
      el.volume = volume
      el.muted = muted
      if (track === current) {
        if (el.paused) {
          el.currentTime = 0
          void el.play().catch(() => {})
        }
      } else if (!el.paused) {
        el.pause()
        el.currentTime = 0
      }
    }
  })

  // Volume/mute changes apply to the live elements without touching
  // playback position.
  $effect(() => {
    const volume = store.volume.value
    const muted = store.muted.value
    for (const track of tracks) {
      const el = elementFor(track)
      if (!el) continue
      el.volume = volume
      el.muted = muted
    }
  })
</script>

<div class="hidden" aria-hidden="true">
  {#each tracks as track (track)}
    <audio id={MUSIC_TRACK_IDS[track]} loop={MUSIC_TRACKS[track].loop} preload="auto">
      <source src={MUSIC_TRACKS[track].src} type="audio/mpeg" />
    </audio>
  {/each}
</div>
