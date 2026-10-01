import type { AssetRegistry } from "../config/assetRegistry";
import type { BitacoraConfig } from "../config/types";
import type { PreferencesStorage } from "../storage/preferencesStorage";
import { MusicPlayer, type MusicDeps, type MusicTrack } from "./MusicPlayer";

/** Pistas de `audio.music` resueltas con el AssetRegistry (URL, título y autor salen del manifiesto). */
export function musicTracks(config: BitacoraConfig, assets: AssetRegistry): MusicTrack[] {
  return config.audio.music.tracks.map((id) => {
    const credit = assets.get(id).credit;
    return { id, url: assets.url(id), title: credit?.title ?? assets.get(id).label, artist: credit?.artist ?? "" };
  });
}

/** `null` cuando la música está desactivada o no hay pistas: entonces no hay nada que controlar. */
export function createMusicPlayer(config: BitacoraConfig, assets: AssetRegistry, preferences: PreferencesStorage, deps: MusicDeps = {}): MusicPlayer | null {
  const { active, rotation, volume, crossfadeMs } = config.audio.music;
  const tracks = musicTracks(config, assets);
  if (!active || tracks.length === 0) return null;
  return new MusicPlayer({ tracks, order: rotation, volume, crossfadeMs }, preferences.musicMuted, {
    ...deps,
    onMutedChange: (muted) => {
      preferences.setMusicMuted(muted);
      deps.onMutedChange?.(muted);
    },
  });
}
