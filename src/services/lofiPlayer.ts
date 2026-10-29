import { LofiTrack } from '../types';
import { DEFAULT_LOFI_TRACKS } from '../data/shop';

type LofiListener = () => void;

class LofiPlayerService {
  private audio: HTMLAudioElement | null = null;
  private tracks: LofiTrack[] = DEFAULT_LOFI_TRACKS;
  private currentIndex: number = 0;
  private playing: boolean = false;
  private muted: boolean = false;
  private listeners: Set<LofiListener> = new Set();
  private isVisible: boolean = false; // mini player bar visibility

  constructor() {
    if (typeof window !== 'undefined') {
      this.initAudio();
    }
  }

  private initAudio() {
    if (!this.audio && typeof Audio !== 'undefined') {
      const cur = this.getCurrentTrack();
      this.audio = new Audio(cur ? cur.src : '');
      this.audio.loop = true;
      this.audio.onended = () => {
        this.next();
      };
      this.audio.onerror = () => {
        // agar trek o'ynalmasa keyingisiga o'tadi
        this.next();
      };
    }
  }

  public setTracks(tracks: LofiTrack[]) {
    if (tracks && tracks.length) {
      this.tracks = tracks;
      this.notify();
    }
  }

  public getTracks(): LofiTrack[] {
    return this.tracks;
  }

  public getCurrentIndex(): number {
    return this.currentIndex;
  }

  public getCurrentTrack(): LofiTrack | undefined {
    return this.tracks[this.currentIndex] || this.tracks[0];
  }

  public isPlaying(): boolean {
    return this.playing;
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public isBarVisible(): boolean {
    return this.isVisible;
  }

  public play() {
    this.initAudio();
    if (!this.audio) return;
    const cur = this.getCurrentTrack();
    if (cur && (!this.audio.src || !this.audio.src.includes(cur.src))) {
      this.audio.src = cur.src;
    }
    this.audio.muted = this.muted;
    this.audio.play()
      .then(() => {
        this.playing = true;
        this.isVisible = true;
        this.notify();
      })
      .catch(() => {
        this.playing = false;
        this.notify();
      });
  }

  public pause() {
    if (this.audio) {
      this.audio.pause();
    }
    this.playing = false;
    this.notify();
  }

  public toggle() {
    if (this.playing) {
      this.pause();
    } else {
      this.play();
    }
  }

  public next() {
    if (!this.tracks.length) return;
    this.currentIndex = (this.currentIndex + 1) % this.tracks.length;
    const cur = this.getCurrentTrack();
    if (this.audio && cur) {
      const wasPlaying = this.playing;
      this.audio.src = cur.src;
      if (wasPlaying) {
        this.audio.play().catch(() => {});
      }
    }
    this.notify();
  }

  public selectTrack(index: number) {
    if (index >= 0 && index < this.tracks.length) {
      this.currentIndex = index;
      const cur = this.getCurrentTrack();
      if (this.audio && cur) {
        this.audio.src = cur.src;
        this.play();
      }
      this.notify();
    }
  }

  public toggleMute() {
    this.muted = !this.muted;
    if (this.audio) {
      this.audio.muted = this.muted;
    }
    this.notify();
  }

  public dismiss() {
    this.pause();
    this.isVisible = false;
    this.notify();
  }

  public subscribe(listener: LofiListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach(l => {
      try { l(); } catch {}
    });
  }
}

export const lofiPlayer = new LofiPlayerService();
