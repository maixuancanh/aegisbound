// Only the approved legacy music and sound effects are reused. No legacy VFX loads here.
const root = import.meta.env.BASE_URL + 'assets/legacy-msu/';
const files = {
  music: '50620daf09df7d7d861d14b3.mp3',
  select: 'd40325a4a38580e8280fce10.mp3',
  cast: '27adeac70dbea560bf90c1cf.mp3',
  capture: '7ac2cb279a6ffbdbdbe22c4f.mp3',
  block: 'eb0d77d8c52430e7b47117ff.mp3',
  breach: 'd2cce21c3db1a250ef31e6b7.mp3',
  win: 'bb00a644fd69de4150142260.mp3',
};

export function createRescueAudio() {
  let enabled = false;
  const music = new Audio(root + files.music);
  music.loop = true;
  music.volume = .22;
  const voices = new Set();
  return {
    get enabled() { return enabled; },
    toggle() {
      enabled = !enabled;
      if (enabled) void music.play().catch(() => {});
      else {
        music.pause();
        for (const voice of voices) voice.pause();
        voices.clear();
      }
      return enabled;
    },
    play(event) {
      if (!enabled || !files[event]) return;
      const clip = new Audio(root + files[event]);
      clip.volume = .45;
      voices.add(clip);
      clip.onended = () => voices.delete(clip);
      clip.onerror = () => voices.delete(clip);
      void clip.play().catch(() => voices.delete(clip));
    },
    stop() {
      music.pause();
      for (const voice of voices) voice.pause();
      voices.clear();
    },
  };
}
