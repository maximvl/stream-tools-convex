import type { ChatServer } from './types'

export const ServerIcons: Record<ChatServer, string> = {
  twitch: 'https://cdn-icons-png.flaticon.com/512/3992/3992643.png',
  vkvideo: 'https://vkvideo.ru/images/icons/favicons/fav_vk_video_2x.ico?8',
  kick: 'https://kick.com/favicon.ico',
  wtv: 'https://w.tv/apple-touch-icon.png',
  // goodgame: 'https://static.goodgame.ru/images/favicon/favicon-32x32.png',
  // nuum: 'https://cdn-icons-png.flaticon.com/512/7261/7261483.png',
  // youtube: 'https://www.youtube.com/s/desktop/e1590144/img/logos/favicon_32x32.png'
}

export const VkColorsMap: { [key: number]: string } = {
  0: '#D66E34',
  1: '#B8AAFF',
  2: '#1D90FF',
  3: '#9961F9',
  4: '#59A840',
  5: '#E73629',
  6: '#DE6489',
  7: '#20BBA1',
  8: '#F8B301',
  9: '#0099BB',
  10: '#7BBEFF',
  11: '#E542FF',
  12: '#A36C59',
  13: '#8BA259',
  14: '#00A9FF',
  15: '#A20BFF',
}

export const STATIC_ROOT = 'https://mapcar.alwaysdata.net/static'
export const IMG_ROOT = `${STATIC_ROOT}/img`

export const FIREWORKS_IMG = `${IMG_ROOT}/fireworks.gif`

export const ANIME_BACKGROUND_IMG = `${IMG_ROOT}/sakura1.webp`
export const PRAY_IMG = `${IMG_ROOT}/pray.webp`
export const CAT_DANCE_IMG = `${IMG_ROOT}/cat_dance.webp`

export const POG_IMG = `${IMG_ROOT}/pog_smile.png`
export const EZ_SMILE_IMG = `${IMG_ROOT}/ez_smile.avif`
export const GAGA_SMILE_IMG = `${IMG_ROOT}/gaga_smile.avif`

const RTE_PROXY = 'https://ext.rte.net.ru:8443'

export const SmileIcons = {
  ez: EZ_SMILE_IMG,
  gaga: GAGA_SMILE_IMG,
  pog: POG_IMG,
  dovolen:
    'https://images.live.vkvideo.ru/smile/2ec232fd-bb31-4122-b3d1-4c8e7b721561/icon/size/medium',
  hypers:
    'https://images.live.vkvideo.ru/smile/c78b5408-e42c-4aeb-b6f5-9ca21d73c0f1/icon/size/medium',
  taah: `${RTE_PROXY}/https://cdn.7tv.app/emote/01HNKT4960000EXZQWSVKBCAGF/4x.webp`,
  xdd: `${RTE_PROXY}/https://cdn.7tv.app/emote/01FF3R5C30000FF5VVCKV49G6J/4x.webp`,
  wires: `${RTE_PROXY}/https://cdn.7tv.app/emote/01G9CSQH88000CPDMWJK87X8GR/4x.webp`,
  wow: `${RTE_PROXY}/https://cdn.7tv.app/emote/01FW2DTC0R0003BP8VG8FC1CH1/4x.webp`,
  catdance: CAT_DANCE_IMG,
  suprise: 'https://cdn.betterttv.net/emote/55028cd2135896936880fdd7/2x',
  peepo_pog: 'https://cdn.betterttv.net/emote/58ae8407ff7b7276f8e594f2/2x',
  sad_cat: 'https://cdn.frankerfacez.com/emoticon/357348/2',
  '4head': 'https://static-cdn.jtvnw.net/emoticons/v2/354/default/dark/1.0',
  lul: 'https://static-cdn.jtvnw.net/emoticons/v2/425618/default/dark/2.0',
  pepega: 'https://cdn.frankerfacez.com/emoticon/243789/2',
  ayaya: 'https://cdn.frankerfacez.com/emoticon/308939/2',
  clown: 'https://cdn.frankerfacez.com/emoticon/318914/2',
  gachi: 'https://cdn.betterttv.net/emote/55999813f0db38ef6c7c663e/2x',
  heh: 'https://cdn.betterttv.net/emote/5d9198fbd2458468c1f4adb7/2x',
  troll: 'https://cdn.betterttv.net/emote/54fa8f1401e468494b85b537/2x',
} as const

export const BackgroundImages = [
  SmileIcons.ez,
  SmileIcons.gaga,
  SmileIcons.pog,
  SmileIcons.dovolen,
  SmileIcons.taah,
  SmileIcons.xdd,
  SmileIcons.wires,
  SmileIcons.wow,
  SmileIcons.suprise,
  SmileIcons.peepo_pog,
  SmileIcons.sad_cat,
  SmileIcons['4head'],
  SmileIcons.lul,
  SmileIcons.pepega,
  SmileIcons.ayaya,
  SmileIcons.clown,
  SmileIcons.gachi,
  SmileIcons.heh,
  SmileIcons.troll,
]

export const SuperGameIcons = {
  x1: SmileIcons.dovolen,
  x2: SmileIcons.hypers,
  x3: SmileIcons.pog,
  bomb: SmileIcons.gaga,
} as const
