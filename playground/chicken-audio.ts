/** Chicken Road audio helpers (Web Audio element pools). */

type Bank = {
  music: HTMLAudioElement | null;
  step: HTMLAudioElement[];
  win: HTMLAudioElement[];
  lose: HTMLAudioElement[];
  click: HTMLAudioElement[];
};

const POOL = 4;

function el(src: string, loop = false, volume = 1): HTMLAudioElement {
  const a = new Audio(src);
  a.loop = loop;
  a.volume = volume;
  a.preload = 'auto';
  return a;
}

function pool(src: string, n: number, volume = 1): HTMLAudioElement[] {
  return Array.from({ length: n }, () => el(src, false, volume));
}

function playPool(items: HTMLAudioElement[]) {
  const a = items.find((x) => x.paused || x.ended) ?? items[0]!;
  a.currentTime = 0;
  void a.play().catch(() => {});
}

let bank: Bank | null = null;
let musicOn = true;
let sfxOn = true;
let unlocked = false;

export const chickenAudio = {
  async load() {
    if (bank) return;
    // Prefer mp3 for Safari; click ships as webm only
    // Volumes: music .3 · steps .5 · win/lose .8
    const music = el('/chicken/audio/Soundtrack.mp3', true, 0.3);
    music.load();
    bank = {
      music,
      step: pool('/chicken/audio/Step_1.mp3', POOL, 0.5),
      win: pool('/chicken/audio/Win_1.mp3', 2, 0.8),
      lose: pool('/chicken/audio/lose.mp3', 2, 0.8),
      click: pool('/chicken/audio/buttonClick.webm', POOL, 0.7),
    };
  },

  unlock() {
    if (!bank) return;
    if (!unlocked) {
      unlocked = true;
      // Warm SFX only — never pause music after starting soundtrack
      const warm = [...bank.step, ...bank.win, ...bank.lose, ...bank.click];
      for (const a of warm) {
        const prev = a.volume;
        a.volume = 0;
        void a
          .play()
          .then(() => {
            a.pause();
            a.currentTime = 0;
            a.volume = prev;
          })
          .catch(() => {
            a.volume = prev;
          });
      }
    }
    if (musicOn) this.playMusic();
  },

  setMusic(on: boolean) {
    musicOn = on;
    if (!bank?.music) return;
    bank.music.muted = !on;
    if (on && unlocked) this.playMusic();
    else bank.music.pause();
  },

  setSfx(on: boolean) {
    sfxOn = on;
  },

  playMusic() {
    if (!bank?.music || !musicOn || !unlocked) return;
    bank.music.muted = false;
    void bank.music.play().catch(() => {});
  },

  click() {
    this.unlock();
    if (!sfxOn || !bank) return;
    playPool(bank.click);
  },

  step() {
    this.unlock();
    if (!sfxOn || !bank) return;
    playPool(bank.step);
  },

  win() {
    if (!sfxOn || !bank) return;
    playPool(bank.win);
  },

  lose() {
    if (!sfxOn || !bank) return;
    playPool(bank.lose);
  },
};
