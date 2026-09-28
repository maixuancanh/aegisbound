import {ARENAS} from './content/arenas.js';
import {CHALLENGES} from './content/challenges.js';
import {PRACTICE_LESSONS} from './content/scenarios.js';
import {TRIALS} from './content/rescue.js';
import {rescueHud} from './rescue.js';
import {assetUrl} from './msu-assets.js';
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const button=(name,action,primary=false)=>'<button type="button" data-action="'+escape(action)+'" class="'+(primary?'primary':'')+'">'+escape(name)+'</button>';
const medalNames=['No medal','Bronze','Silver','Gold'];
const metric=(label,value)=>'<div class="result-stat"><dt>'+escape(label)+'</dt><dd>'+escape(value)+'</dd></div>';
const timer=ticks=>{const seconds=Math.ceil(Math.max(0,ticks)/60);return String(Math.floor(seconds/60)).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0');};
const hudIcon=(src,alt,active=true)=>'<img src="'+assetUrl(src)+'" alt="'+(active?alt:'')+'" aria-hidden="'+(active?'false':'true')+'" class="hud-icon'+(active?'':' is-empty')+'">';
export function createUI(overlay,onAction){
  const nodes=Object.fromEntries(['hud','wave','time','hearts','covers','score','cue','cue-text','cover-summary','rescue-objective','objective','objective-progress','objective-detail','rescue-incident','incident-label','incident-time','rescue-actions','release-mode','release-mode-label','release-mode-detail','repair','repair-detail','park-cover'].map(id=>[id,document.getElementById(id)]));
  const write=(id,value)=>{const text=String(value??'');if(nodes[id].textContent!==text)nodes[id].textContent=text;};
  let lastIncident='';
  overlay.addEventListener('click',event=>{
    const element=event.target.closest('[data-action]');
    if(element&&!element.disabled)onAction(element.dataset.action);
  });
  function show(title,content,actions='',eyebrow='BORROWED SHELTER',variant=''){
    overlay.innerHTML='<section class="surface '+variant+'" aria-labelledby="screen-title"><div class="surface-body"><p class="eyebrow">'+escape(eyebrow)+'</p><h1 id="screen-title" tabindex="-1">'+escape(title)+'</h1>'+content+'<div class="actions">'+actions+'</div></div></section>';
    overlay.querySelector('h1').focus({preventScroll:true});
  }
  return {
    clear(){overlay.replaceChildren();},
    tutorialResult(){show('Ready to rescue','<p>You parked cover, blocked a shot and brought a captured enemy back as shelter. In rescue, place cover along the evacuation route. Held cover cannot shield anyone.</p>',button('Start rescue','finish-tutorial',true)+button('Repeat lesson','tutorial'),'BORROWED SHELTER','modal-result');},
    loading(done,total,phase='Preparing your shelter'){
      let loading=overlay.querySelector('.loading-screen');
      if(!loading){
        overlay.innerHTML='<section class="loading-screen" aria-label="Loading Kinesis: Borrowed Shelter" aria-busy="true"><img class="loading-logo" src="'+assetUrl('assets/artgen/kinesis-logo-v1.png')+'" alt="Kinesis: Borrowed Shelter"><div class="loading-status"><div class="loading-label"><span id="loading-caption" role="status" aria-live="polite"></span><span class="loading-percent" aria-hidden="true"></span></div><progress class="loading-progress" max="100" aria-label="Game loading progress"></progress></div></section>';
        loading=overlay.querySelector('.loading-screen');
      }
      const percent=total>0?Math.min(100,Math.max(0,Math.floor(done/total*100))):null;
      const caption=loading.querySelector('#loading-caption');
      if(caption.textContent!==phase)caption.textContent=phase;
      loading.querySelector('.loading-percent').textContent=percent===null?'':percent+'%';
      const progress=loading.querySelector('progress');
      if(percent===null)progress.removeAttribute('value');else progress.value=percent;
    },
    assetGap(gaps){show('MSU resources unavailable','<p>The scene could not load its required source assets. Retry loading to enter the arena.</p><p class="warning">'+gaps.map(escape).join('<br>')+'</p>',button('Retry assets','load',true)+button('Open mechanics lab','lab'));},
    title(warning,lab){show('Kinesis','<img class="title-logo" src="'+assetUrl('assets/artgen/kinesis-logo-v1.png')+'" alt="Kinesis: Borrowed Shelter"><img class="title-vignette" src="'+assetUrl('assets/artgen/kinesis-title-vignette-v6.png')+'" alt="" aria-hidden="true">'+(warning?'<p class="warning">Save unavailable</p>':''),
      button('Quick rescue','quick',true)+button('Practice','practice')+button('Arena trials','arenas')+button('Challenges','challenges')+button('Records','records')+button('Settings','settings')+button('Help','help')+button('Credits','credits'),'BORROWED SHELTER','title-screen');},
    arenas(profile){show('Choose your trial','<div class="cards">'+TRIALS.map((a,i)=>'<button type="button" class="card" data-action="arena:'+i+'" aria-label="'+escape(a.name+'. '+a.subtitle+'. '+Math.ceil(a.durationTicks/60)+' seconds. Best score '+(profile?.trialBest?.[i]??0)+'. '+medalNames[profile?.trialMedals?.[i]??0])+ '"><span><strong>'+escape(a.name)+'</strong></span></button>').join('')+'</div>',button('Back','title'),'COURTYARD TRIALS','arena-screen');},
    challenges(profile){show('Challenges','<div class="cards">'+CHALLENGES.map((c,i)=>{const earned=profile?.challengeMedals?.[i]??0,medal=earned?medalNames[earned]:'';return '<button class="card" data-action="challenge:'+i+'" aria-label="'+escape(c.name+'. '+c.description+'. '+c.durationTicks/60+' seconds'+(medal?'. '+medal+' medal earned':'') )+'"><span><strong>'+escape(c.name)+'</strong>'+(medal?'<small>'+escape(medal)+'</small>':'')+'</span></button>';}).join('')+'</div>',button('Back','title'),'CHALLENGES','challenge-screen');},
    challengeBriefing(index){const challenge=CHALLENGES[index];show(challenge.name,'<p>'+escape(challenge.objective)+'</p><dl class="result-grid">'+metric('Bronze',challenge.medals.bronze)+metric('Silver',challenge.medals.silver)+metric('Gold',challenge.medals.gold)+'</dl>',button('Start challenge','start-challenge:'+index,true)+button('Back','challenges'),'CHALLENGE BRIEFING','modal-result');},
    practice(){show('Practice','<div class="practice-content"><div class="cards practice-lessons">'+PRACTICE_LESSONS.map((lesson,index)=>'<button type="button" class="card" data-action="lesson:'+index+'"><strong>'+escape(lesson.name)+'</strong></button>').join('')+'</div></div>',button('Back','title'),'PRACTICE','practice-screen');},
    pause(reason){show('Paused','',button('Resume','resume',true)+button('Restart run','restart')+button('Settings','settings')+button('Leave run','leave'),'BORROWED SHELTER','modal-result');},
    settings(profile,onChange){
      const s=profile.settings;
      show('Settings','<p>Music and sound effects use original MSU audio. The diagnostic lab is silent.</p><div class="settings">'+[['music','Music volume'],['sfx','Sound effects volume']].map(([key,label])=>'<label>'+label+'<input data-setting="'+key+'" type="range" min="0" max="1" step=".05" value="'+s[key]+'"></label>').join('')+
        [['mute','Mute'],['reducedMotion','Reduced motion'],['reducedFlash','Reduced flashes'],['highContrast','High contrast']].map(([key,label])=>'<label>'+label+'<input data-setting="'+key+'" type="checkbox" '+(s[key]?'checked':'')+'></label>').join('')+'</div>',button('Back','back'),'BORROWED SHELTER','settings-screen');
      overlay.querySelectorAll('[data-setting]').forEach(input=>input.addEventListener('input',()=>onChange(input.dataset.setting,input.type==='checkbox'?input.checked:Number(input.value))));
    },
    result(state){
      if(state.mode==='rescue'||state.mode==='trial'||state.mode==='challenge'){
        const r=state.rescue??{},trial=state.mode==='trial'?TRIALS[state.arena]:null;
        const reason=state.status==='won'?(trial?'Trial objective complete.':'The van has departed. These are the final evacuation totals.'):
          ({hearts:'Kinesis could not hold out until the rescue was complete.',covers:'No usable shelter remained.',relay:'The relay was destroyed.',time:'The objective was not completed before time ran out.'}[state.reason]??'The objective was not completed. These are the final totals.');
        const stats=metric('Boarded',r.boarded??0)+metric('Casualties',r.lost??0)+metric('Score',state.score)+metric('Best counter chain',state.stats.bestCounterChain??0);
        const replay=state.replayAvailable?button('Practice this failure','replay'):'';
        const replayNote=state.failureAnalysis?.message?'<p class="replay-note">'+escape(state.failureAnalysis.message)+'</p>':'';
        show(trial?(state.status==='won'?'Trial cleared':'Trial ended'):(state.mode==='challenge'?(state.status==='won'?'Challenge cleared':'Challenge ended'):(state.status==='won'?'Rescue complete':'Rescue ended')),replayNote+'<dl class="result-grid">'+stats+'</dl>',button('Try again','restart',true)+replay+button('Main menu','title'),trial?.name??'BORROWED SHELTER','modal-result tactical-result');
        return;
      }
      if(state.mode==='practice'&&state.rescue?.lesson){
        show(state.status==='won'?'Lesson complete':'Lesson reset','<p>'+escape(state.rescue.lesson.objective)+'</p>',button('Repeat lesson','restart',true)+button('Practice menu','practice')+button('Main menu','title'),'PRACTICE','modal-result');
        return;
      }
      const reason={covers:'All covers were lost. A flying cover only comes back after a capture.',hearts:'Your shelter left a threat unblocked.',time:'Time ran out before the objective was complete.','challenge-damage':'This challenge requires keeping every heart.','challenge-miss':'This challenge requires every throw to find a target.'}[state.reason]??'You kept your shelter alive.';
      show(state.status==='won'?'Shelter secured':'Shelter broken','<dl class="result-grid">'+metric('Score',state.score)+metric('Captures / best streak',state.stats.captures+' / '+state.stats.bestStreak)+'</dl>',button('Try again','restart',true)+button('Main menu','title'),'BORROWED SHELTER','modal-result');
    },
    rescueChoice(state){
      const r=state.rescue,remaining=r.npcs.filter(n=>!['boarded','lost'].includes(n.status)).length;
      show('One more group?','<p class="choice-summary">'+escape(r.boarded)+' boarded · '+escape(r.lost)+' casualties · '+remaining+' still outside</p><div class="choice-copy"><p><strong>Depart now.</strong> End the rescue with the current evacuation. You give up the optional final group.</p><p><strong>Stay 60 seconds.</strong> Give one final group a chance. Hearts, cover damage and repair kits carry over; civilians outside and Kinesis remain at risk.</p></div><p class="choice-resources">'+state.hearts+' / '+(state.maxHearts??6)+' hearts · '+r.kits+' repair kits · clock paused</p>',button('Depart now','depart',true)+button('Stay · +60s','stay'),'FINAL GROUP · OPTIONAL','modal-result rescue-choice');
    },
    records(profile){
      const best=profile.rescueBest??{score:0,boarded:0,wins:0,bestChain:0};
      show('Records','<div class="records-content"><section><h2 class="section-label">Best rescue</h2><dl class="result-grid">'+metric('Score',best.score)+metric('Boarded',best.boarded)+metric('Wins',best.wins)+metric('Best chain',best.bestChain)+'</dl></section><section class="trial-records"><h2 class="section-label">Trials</h2>'+TRIALS.map((a,i)=>'<div class="record"><span>'+escape(a.name)+'</span><span>'+(profile.trialBest?.[i]??0)+' · '+medalNames[profile.trialMedals?.[i]??0]+'</span></div>').join('')+'</section><details><summary>Previous arcade records</summary>'+ARENAS.map((a,i)=>'<div class="record"><span>'+escape(a.name)+'</span><span>'+profile.best[i]+' · '+medalNames[profile.medals[i]]+'</span></div>').join('')+'</details></div>',button('Back','title')+button('Reset progress','reset-confirm'),'','records-screen');
    },
    confirm(kind){show(kind==='reset'?'Reset local progress?':'Leave this run?','<p>'+ (kind==='reset'?'Medals, records and badges on this device will be removed.':'This run will not be saved. Your existing records stay unchanged.')+'</p>',button('Cancel',kind==='reset'?'records':'resume',true)+button('Confirm',kind==='reset'?'reset':'title'));},
    help(){show('How to play','<div class="help-copy"><p class="help-intro">Protect civilians, then clear the pickup lane.</p><div class="help-steps"><p><strong>Place:</strong> Set cover down to block incoming fire.</p><p><strong>Throw:</strong> Move cover around Kinesis to aim. Pull farther for more power, then release.</p><p><strong>Repair:</strong> Select damaged cover and use a repair kit when it is ready.</p></div></div>',button('Play tutorial','tutorial',true)+button('Start rescue','quick')+button('Back','title'),'','help-screen');},
    credits(){show('Credits','<div class="credits-copy"><p>Kinesis: Borrowed Shelter was created for Vibe Camp Season 2.</p><p>Art and audio resources are provided through <a href="https://resource-search.msu.io/" target="_blank" rel="noreferrer">MSU Resource Search</a>.</p><p>All resources belong to their respective owners.</p></div>',button('Back','title'),'BORROWED SHELTER','credits-screen');},
    hud(state,{active=false,releaseMode='throw',tutorial=false}={}){
      const tactical=Boolean(state.tactical),r=state.rescue;
      nodes.hud.classList.toggle('tactical',tactical);nodes.cue.classList.toggle('tactical',tactical);
      // Tactical controls live on the canvas/keyboard. Leaving this legacy cue
      // visible creates an empty framed strip at the bottom of every rescue.
      nodes.cue.hidden=tactical;
      nodes['rescue-objective'].hidden=!tactical;nodes['rescue-actions'].hidden=!tactical;
      nodes['park-cover'].hidden=tactical;
      nodes['cover-summary'].hidden=!tactical;
      write('wave',tutorial?'LESSON':state.mode==='trial'?'TRIAL '+(state.arena+1):state.mode==='arcade'?'WAVE '+(state.wave+1)+' / 4':state.mode.toUpperCase());
      write('wave','SCORE '+state.score);
      const deadline=tactical&&Number.isFinite(r?.deadline)?r.deadline:state.durationTicks;
      write('time',state.mode==='practice'&&!state.replay?'NO TIMER':r?.phase==='choice'?'PAUSED':r?.phase==='departing'?'LEAVING':timer(deadline-state.tick));
      const maxHearts=Math.max(1,Math.min(12,Math.trunc(state.maxHearts??3))),hearts=Math.max(0,Math.min(maxHearts,Math.trunc(state.hearts)));
      nodes.hearts.innerHTML=Array.from({length:maxHearts},(_,i)=>hudIcon('assets/artgen/kinesis-icon-heart-v1.png','Heart '+(i+1),i<hearts)).join('');
      nodes.hearts.setAttribute('aria-label',hearts+' of '+maxHearts+' hearts');
      const coverCount=state.covers.filter(c=>['placed','orbit','held'].includes(c.status)).length;
      nodes.covers.innerHTML=Array.from({length:3},(_,i)=>hudIcon('assets/artgen/kinesis-icon-shelter-v1.png','Shelter '+(i+1),i<coverCount)).join('');
      nodes.covers.setAttribute('aria-label',coverCount+' of 3 shelters available');
      nodes.score.hidden=true;
      const held=state.covers.find(c=>c.status==='held');
      nodes['park-cover'].disabled=!active||!held;
      if(!tactical){nodes['rescue-incident'].hidden=true;lastIncident='';return;}
      const summary=rescueHud(state);
      nodes['rescue-objective'].setAttribute('aria-label',[summary.label,summary.objective,summary.progress,summary.detail].filter(Boolean).join(' · '));
      write('objective',summary.label);write('objective-progress',summary.progress);write('objective-detail','');
      nodes['rescue-objective'].title=[summary.label,summary.objective,summary.progress,summary.detail].filter(Boolean).join(' · ');
      const incident=r?.incident,incidentText=summary.incident??incident?.label??'';
      nodes['rescue-incident'].hidden=!incident;
      write('incident-label',incidentText);write('incident-time',incident?timer(incident.endsAt-state.tick)+' remaining':'');
      if(incidentText!==lastIncident){lastIncident=incidentText;document.querySelector('#status').textContent=incidentText;}
      const enabled=active&&state.status==='running'&&!['choice','departing'].includes(r?.phase);
      nodes['release-mode'].disabled=!enabled;
      nodes['release-mode'].setAttribute('aria-pressed',String(releaseMode==='place'));
      nodes['release-mode'].setAttribute('aria-label','Release mode: '+releaseMode+'. Switch to '+(releaseMode==='place'?'throw':'place'));
      write('release-mode-label',releaseMode==='place'?'Place':'Throw');write('release-mode-detail','on release · switch');
      const selected=held??state.covers.find(c=>c.id===state.selectedCoverId);
      const cooldown=Math.ceil(Math.max(0,(r?.repairReadyAt??0)-state.tick)/60);
      const canRepair=selected&&['placed','orbit','held'].includes(selected.status)&&selected.hp<selected.maxHp;
      nodes.repair.disabled=!enabled||!canRepair||!(r?.kits>0)||cooldown>0;
      write('repair-detail',(r?.kits??0)+' kits · '+(cooldown?cooldown+'s':'F'));
      nodes.repair.title=!(r?.kits>0)?'No repair kits remaining':cooldown?'Repair ready in '+cooldown+' seconds':!canRepair?'Select damaged cover to repair':'Repair selected cover (F)';
      const charge=selected?Math.max(0,Math.min(3,Math.trunc(selected.charge??0))):0;
      write('cover-summary',selected?selected.kind+' · HP '+(selected.hp??0)+'/'+(selected.maxHp??0)+' · CHARGE '+'●'.repeat(charge)+'○'.repeat(3-charge):'Pick cover to protect the evacuation route');
      write('cue-text',r?.phase==='departing'?'Van departing…':releaseMode==='place'?'AIM FOR SHELTER · RELEASE TO PLACE':'AIM AT A THREAT · RELEASE TO THROW');
    }
  };
}
