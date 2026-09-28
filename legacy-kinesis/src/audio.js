// Authored diagnostic synthesis. Final mix/BGM and art acceptance remain separate.
export const CUES=Object.freeze({
  select:{from:420,to:630,duration:.08,wave:'sine'},
  block:{from:160,to:90,duration:.12,wave:'triangle'},
  throw:{from:520,to:140,duration:.16,wave:'sawtooth'},
  capture:{from:660,to:990,duration:.16,wave:'sine'},
  return:{from:400,to:800,duration:.10,wave:'triangle'},
  miss:{from:160,to:80,duration:.24,wave:'sine'},
  damage:{from:90,to:45,duration:.20,wave:'sawtooth'},
  clear:{from:520,to:1040,duration:.45,wave:'triangle'},
  fail:{from:220,to:55,duration:.45,wave:'triangle'}
});
export function createAudio(factory=()=>new (globalThis.AudioContext??globalThis.webkitAudioContext)()){
  let context=null,available=false;const voices=new Set();
  return {
    async unlock(){
      try{context??=factory();if(context.state==='suspended')await context.resume();available=context.state==='running';return available;}
      catch{available=false;return false;}
    },
    play(events,settings){
      if(!available||settings.mute||settings.sfx<=0)return;
      for(const event of events){
        const cue=CUES[event.type];if(!cue||voices.size>=8)continue;
        const oscillator=context.createOscillator(),gain=context.createGain(),now=context.currentTime;
        oscillator.type=cue.wave;oscillator.frequency.setValueAtTime(cue.from,now);
        oscillator.frequency.exponentialRampToValueAtTime(cue.to,now+cue.duration);
        gain.gain.setValueAtTime(.0001,now);gain.gain.linearRampToValueAtTime(settings.sfx*.055,now+.01);
        gain.gain.exponentialRampToValueAtTime(.0001,now+cue.duration);
        oscillator.connect(gain);gain.connect(context.destination);voices.add(oscillator);
        oscillator.onended=()=>{voices.delete(oscillator);oscillator.disconnect();gain.disconnect();};
        oscillator.start(now);oscillator.stop(now+cue.duration+.02);
      }
    },
    stop(){for(const voice of voices){try{voice.stop();}catch{/* Already stopped. */}}voices.clear();}
  };
}
