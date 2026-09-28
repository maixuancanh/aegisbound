import {assetUrl} from './msu-assets.js';
export const REQUIRED_AUDIO_EVENTS=Object.freeze([
  'select','throw','place','block','enemy-shot','melee-hit','armor-hit','armor-break',
  'capture','return','repair','cover-hit','cover-broken','relay-hit','civilian-hit',
  'civilian-lost','miss','damage','enemy-hit','clear','fail'
]);
export const AUDIO_EVENT_MAP=Object.freeze({
  select:{record:'psychic-clutch',action:'Use'},throw:{record:'psychic-clutch',action:'End'},
  place:{record:'psychic-bulwark',action:'Use'},block:{record:'psychic-bulwark',action:'Use'},
  'enemy-shot':{record:'hunter-bowgun',action:'Use'},'melee-hit':{record:'hunter-bowgun',action:'Hit'},
  'armor-hit':{record:'hunter-bowgun',action:'Hit'},'armor-break':{record:'psychic-bulwark',action:'Use'},
  capture:{record:'psychic-grab',action:'Use'},return:{record:'psychic-grab',action:'End'},
  repair:{record:'psychic-grab',action:'Use'},'cover-hit':{record:'kerning-necki',action:'Damage'},
  'cover-broken':{record:'kerning-bubbling',action:'Die'},'relay-hit':{record:'hunter-bowgun',action:'Hit'},
  'civilian-hit':{record:'kerning-octopus',action:'Damage'},'civilian-lost':{record:'kerning-octopus',action:'Die'},
  miss:{record:'kerning-stirge',action:'Damage'},damage:{record:'kerning-necki',action:'Damage'},
  'enemy-hit':{record:'hunter-bowgun',action:'Hit'},
  clear:{record:'speed-infusion',action:'Use'},fail:{record:'kerning-bubbling',action:'Die'}
});
export function createMsuAudio(){
  let records=null,music=null,unlocked=false,playing=false,settings={mute:false,music:.5,sfx:.6};
  const voices=new Set();
  function update(next){settings={...next};if(music)music.volume=settings.mute?0:settings.music;}
  function stop(){playing=false;music?.pause();for(const v of voices)v.pause();voices.clear();}
  return {
    configure(assets){records=assets.records;music=new Audio(assetUrl('assets/audio/YggdrasilPrayer.mp3'));music.loop=true;update(settings);},
    async unlock(){unlocked=true;if(playing&&music)await music.play().catch(()=>{});},
    update,stop,
    start(next,restart=true){update(next);playing=true;if(music){if(restart)music.currentTime=0;music.play().catch(()=>{});}},
    play(events,next){update(next);if(!records||!unlocked||settings.mute||settings.sfx<=0)return;
      for(const event of events){const cue=AUDIO_EVENT_MAP[event.type],source=cue&&records[cue.record]?.sounds?.[cue.action];if(!source||voices.size>=8)continue;
        const v=new Audio(assetUrl(source.localPath));v.volume=settings.sfx*.5;voices.add(v);
        const done=()=>voices.delete(v);v.onended=done;v.onerror=done;v.play().catch(done);}
    }
  };
}
