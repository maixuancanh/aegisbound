export const normalizeAssetPath=path=>String(path).replace(/^\/+/, '');
export const assetUrl=path=>import.meta.env.BASE_URL+normalizeAssetPath(path);
const recordsFiles=['manifest-2026-09-10T03-29-39-011Z.json','manifest-2026-09-10T06-21-19-165Z.json','production-manifest-2026-09-10T06-40-48-352Z.json','production-manifest-2026-09-13T10-48-50-893Z.json','production-manifest-2026-09-16T02-51-44-414Z.json','rescue-run-manifest-2026-09-14.json','roster-v1/manifest-2026-09-14T06-58-25-559Z.json'];
const mapFile='map-manifest-2026-09-10T03-32-20-917Z.json';
const ACTIVE_RECORDS=new Set(['kinesis-npc','psychic-clutch','psychic-bulwark','psychic-grab','kinesis-theme','kerning-octopus','kerning-necki','kerning-bubbling','kerning-stirge','kinesis-body','kinesis-head','kinesis-uniform','kinesis-wig','kinesis-shoes','kinesis-face','speed-infusion','blitz-shield','shield-mastery','hunter-bowgun','roof-environment','observatory-environment','rescue-civilian-0','rescue-civilian-1','rescue-civilian-2','rescue-vehicle','rescue-relay','roster-lupin','roster-iron-boar-raider','roster-block-golem','roster-jr-boogie','roster-king-clang']);
const STAGE_PROP_PATHS=new Set(['Map/Obj/acc2/metroCity/artificiality/10/0.png','Map/Obj/acc2/metroCity/artificiality/13/0.png','Map/Obj/acc2/metroCity/artificiality/17/0.png','Map/Obj/acc2/metroCity/artificiality/22/0.png','Map/Obj/acc2/metroCity/artificiality/26/0.png','Map/Obj/acc2/metroCity/wallacc/14/0.png','Map/Obj/houseMC/house4/basic/0/0.png','Map/Obj/houseMC/house3/basic/0/0.png','Map/Obj/houseMC/house6/basic/0/0.png','Map/Obj/houseMC/house7/basic/0/0.png']);
async function json(name){const response=await fetch(assetUrl('assets/msu/'+name),{signal:AbortSignal.timeout(30000)});
  if(!response.ok)throw Error('MSU manifest unavailable: '+name);return response.json();}
export async function loadMsuAssets(progress=()=>{}){
  const manifests=await Promise.all(recordsFiles.map(json)),map=await json(mapFile);
  const records=Object.fromEntries(manifests.flatMap(m=>m.records).map(r=>[r.key,r]));
  const paths=new Set(),audioPaths=new Set(),images=new Map();
  function collect(value){if(!value||typeof value!=='object')return;
    if(value.localPath?.endsWith('.png'))paths.add(value.localPath);
    if(/\.(mp3|ogg|wav)$/.test(value.localPath??''))audioPaths.add(value.localPath);
    for(const part of Object.values(value))if(typeof part==='object')collect(part);}
  // The manifests contain archival frames that never render in this game. Load
  // only the authored runtime set so the title screen reaches a playable state
  // before the browser's first interaction timeout.
  for(const [key,record] of Object.entries(records))if(ACTIVE_RECORDS.has(key))collect(record);
  collect({
    backgrounds:map.backgrounds.filter(background=>[0,2].includes(background.placement?.no)),
    tiles:map.tiles.filter(tile=>tile.dependency==='Map/Tile/brownBrick.json'&&tile.placement?.u==='bsc'),
    objects:map.objects.filter(object=>STAGE_PROP_PATHS.has(object.frames?.[0]?._path))
  });
  const stageManifest=await fetch(assetUrl('assets/artgen/stages/manifest-v1.json'),{signal:AbortSignal.timeout(30000)});
  if(!stageManifest.ok)throw Error('Stage background manifest unavailable');
  const stageData=await stageManifest.json();
  const total=paths.size+audioPaths.size+stageData.stages.length;
  const queue=[...paths];let done=0;
  progress(done,total,'Loading characters');
  await Promise.all(Array.from({length:6},async()=>{while(queue.length){const path=queue.shift();
    const image=await new Promise((resolve,reject)=>{const img=new Image();
      const timer=setTimeout(()=>reject(Error('Timed out loading '+path)),30000);
      img.onload=()=>{clearTimeout(timer);resolve(img);};img.onerror=()=>{clearTimeout(timer);reject(Error('Missing MSU image: '+path));};img.src=assetUrl(path);});
    images.set(path,image);progress(++done,total,'Loading characters');
  }}));
  // Preload source audio in the normal loader, so a run never silently substitutes sound.
  const audioUrls=new Map();
  try{
    progress(done,total,'Loading sound');
    for(const path of audioPaths){
      const response=await fetch(assetUrl(path),{signal:AbortSignal.timeout(30000)});
      if(!response.ok)throw Error('Missing MSU audio: '+path);
      audioUrls.set(path,URL.createObjectURL(await response.blob()));
      progress(++done,total,'Loading sound');
    }
  }catch(error){for(const url of audioUrls.values())URL.revokeObjectURL(url);throw error;}
  const stageImages={};
  progress(done,total,'Preparing arenas');
  try{await Promise.all(stageData.stages.map(stage=>new Promise((resolve,reject)=>{
    const image=new Image();
    const timer=setTimeout(()=>reject(Error('Timed out loading stage: '+stage.file)),30000);
    image.onload=()=>{clearTimeout(timer);stageImages[stage.key]=image;progress(++done,total,'Preparing arenas');resolve();};
    image.onerror=()=>{clearTimeout(timer);reject(Error('Missing stage background: '+stage.file));};
    image.src=assetUrl(stage.asset);
  })));}catch(error){for(const url of audioUrls.values())URL.revokeObjectURL(url);throw error;}
  return {records,map,images,audioUrls,stageManifest:stageData,stageImages,releaseReady:false,
    dispose(){for(const url of audioUrls.values())URL.revokeObjectURL(url);}};
}
