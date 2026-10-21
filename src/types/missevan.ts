export interface MissEvanDanmakuItem {
  id: string;
  time: number; // in seconds
  endTime: number; // in seconds
  mode: number; // 1: scroll, 4: bottom subtitle, 5: top subtitle
  size: number;
  color: number;
  colorHex: string;
  createTime: number;
  pool: number;
  userId: string;
  dmId: string;
  text: string;
  userNote?: string;
  isCustom?: boolean;
  role?: string;
  isOfficialSubtitle?: boolean;
  translatedText?: string;
  translatedRole?: string;
  translationLang?: 'vi' | 'en' | 'es';
}

export interface MissEvanSoundInfo {
  id: number;
  soundstr: string;
  intro: string;
  duration: number; // in milliseconds
  username: string;
  user_id: number;
  cover_image: string;
  front_cover?: string;
  mosaic_url?: string;
  soundurl?: string;
  soundurl_128?: string;
  soundurl_64?: string;
  videourl?: string;
  audio_filesize?: number;
  subtitle_url?: string;
  need_pay?: number;
  pay_type?: number;
  price?: number;
}

export interface MissEvanOfficialSubtitleEntry {
  start_time: number; // in milliseconds
  end_time: number;   // in milliseconds
  role_id?: number;
  role?: string;
  content: string;
  color?: number;
  italic?: boolean;
  underline?: boolean;
}

export type FilterMode = 'official_subs' | 'subtitles_only' | 'static_only' | 'all' | 'custom_uid';

export interface FilterOptions {
  mode: FilterMode;
  selectedUid: string;
  smartClean: boolean;
  minDuration: number;
  maxDuration: number;
  timeOffset: number;
  searchQuery: string;
}

export interface UserStats {
  userId: string;
  count: number;
  mode4Count: number;
  firstTime: number;
  lastTime: number;
}

export interface MissEvanEpisode {
  id: number;
  name: string; // e.g. "1-1", "第01集"
  sound_id: number;
  soundstr: string;
  duration: string | number; // in milliseconds
  need_pay?: number;
  type?: number;
  front_cover?: string;
  cover_image?: string;
}

export interface MissEvanDrama {
  id: number;
  name: string;
  author: string;
  cover: string;
  abstract?: string;
  type?: string;
  type_name?: string;
  catalog_name?: string;
  user_id?: number;
}

export interface MissEvanDramaData {
  drama: MissEvanDrama;
  episodes: {
    episode: MissEvanEpisode[];
    ft?: MissEvanEpisode[];
    music?: MissEvanEpisode[];
  };
}
