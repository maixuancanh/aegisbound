import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
test('standalone entry shows USDC as a display unit without demo labels',async()=>{
 const html=await readFile(new URL('../index.html',import.meta.url),'utf8').catch(()=>'');
 for(const text of ['USDC','id="wager"','id="formation"','id="cast"','aria-live="polite"']) assert.ok(html.includes(text),text);
 assert.doesNotMatch(html,/DEMO CREDITS|DEMO BALANCE|Demo credits have no cash value|Demo only/i);
});
test('result dialog orders amount, multiplier, rescued count, and Continue',async()=>{
 const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
 const dialog=html.match(/<dialog id="result-dialog"[\s\S]*?<\/dialog>/)?.[0]??'';
 assert.ok(dialog.indexOf('id="round-return"')<dialog.indexOf('id="round-multiplier"'));
 assert.ok(dialog.indexOf('id="round-multiplier"')<dialog.indexOf('id="round-rescued"'));
 assert.match(dialog,/>CONTINUE<\/button>/);
 assert.doesNotMatch(dialog,/>RETURN<|>PLAY AGAIN</);
});
test('Continue resets to ready state without submitting another wager',async()=>{
 const main=await readFile(new URL('../src/original-main.mjs',import.meta.url),'utf8');
 const handler=main.match(/\$\('play-again'\)\.addEventListener\('click',[\s\S]*?\n\}\);/)?.[0]??'';
 assert.match(handler,/startIdle\(\)/);
 assert.match(handler,/READY TO CAST/);
 assert.doesNotMatch(handler,/requestSubmit|bridge\.cast|demo\.start/);
});
test('standalone entry loads the original Quick Play presenter', async () => {
 const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
 assert.match(html, /src\/original-main\.mjs/);
 assert.match(html, /id="cast"[^>]*disabled/);
 assert.match(html, /RESCUED/);
 assert.doesNotMatch(html, /Two breaches end the round/);
});
test('automatic rescue uses the original engine, audio and renderer with isolated character art', async () => {
 const main=await readFile(new URL('../src/original-main.mjs',import.meta.url),'utf8');
 assert.match(main, /createOriginalScenario/);
 assert.match(main, /createMsuAudio/);
 assert.match(main, /useOriginalCharacterArt/);
 assert.doesNotMatch(main, /auto-rescue-scene/);
 assert.match(main, /lock\(embedded \|\| demo\.phase !== 'ready'\)/);
 assert.doesNotMatch(main, /reducedMotion \? 12 : 4/);
 assert.match(main, /runner\.advance\(originalScenarioCommands\(runner\.state, formation\)\)/);
});
test('Aegisbound starts the supplied Yggdrasil Prayer track at 25 percent', async () => {
 const main=await readFile(new URL('../src/original-main.mjs',import.meta.url),'utf8');
 const audio=await readFile(new URL('../legacy-kinesis/src/msu-audio.js',import.meta.url),'utf8');
 assert.match(main, /mute: false, music: \.25/);
 assert.match(main, /audio\.configure\(assets\);\s*audio\.start\(audioSettings, false\)/);
 assert.match(audio, /assets\/audio\/YggdrasilPrayer\.mp3/);
 assert.match(audio, /music\.volume=settings\.mute\?0:settings\.music/);
});
