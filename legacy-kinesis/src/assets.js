export async function loadAssets(entries,loadImage,onProgress=()=>{}){
  const assets={},failed=[];let finished=0;
  await Promise.all(entries.map(async entry=>{
    try{assets[entry.id]=await loadImage(entry);}
    catch(error){failed.push({id:entry.id,critical:entry.critical,message:String(error.message??error)});}
    finished++;onProgress(finished,entries.length);
  }));
  return {assets,failed,ready:!failed.some(f=>f.critical)};
}
export function browserImage(entry){
  return new Promise((resolve,reject)=>{
    const img=new Image();
    img.onload=()=>resolve(img);img.onerror=()=>reject(new Error('Asset failed: '+entry.id));
    img.src=entry.path;
  });
}
