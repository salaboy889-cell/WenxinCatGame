const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const audios=[];global.tt={getStorageSync:()=>false,createInnerAudioContext(){const a={stopped:0,played:0,stop(){this.stopped++;},play(){this.played++;if(this.playedCallback)this.playedCallback();},onError(fn){this.errorCallback=fn;},onPlay(fn){this.playedCallback=fn;}};audios.push(a);return a;}};
const sound=require('../js/sound');
test('age and state choose original recording banks; default ignores obsolete disabled flag',()=>{
 assert.match(sound.voiceFor({growth:0},'pet'),/^small-/);assert.match(sound.voiceFor({growth:150},'feed'),/^young-/);assert.equal(sound.voiceFor({growth:400},'pet'),'teen');assert.equal(sound.voiceFor({growth:800,sex:'boy'},'pet'),'adult-boy');assert.equal(sound.voiceFor({growth:800,sex:'girl'},'pet'),'adult-girl');
 assert.equal(sound.voiceFor({growth:800,hunger:20},'welcome'),'hungry');assert.equal(sound.voiceFor({sleeping:true,hunger:20},'welcome'),'purr');assert.equal(sound.voiceFor({sleeping:false},'sleep'),'purr');assert.notEqual(sound.voiceFor({sleeping:true},'sleep'),'purr');
 sound.playWelcome({growth:800,hunger:60});assert.equal(audios.at(-1).played,1);assert.equal(sound.setEnabled,undefined);
});
test('consecutive clicks restart quietly with no cooldown, no overlapping cat audio, and background stop cancels replay',()=>{
 sound.playMeow({growth:800,sex:'boy'},'feed');const a=audios.find(a=>a.src.endsWith('voice-adult-boy.mp3')),before=a.played;for(let i=0;i<5;i++)sound.playMeow({growth:800,sex:'boy'},'feed');assert.equal(a.played,before+5);assert.ok(a.stopped>=5);assert.ok(a.volume<=.4);assert.equal(a.loop,false);
 sound.playNotification();const message=audios.find(a=>a.src.endsWith('voice-message.mp3'));assert.ok(message&&message.played===1);assert.ok(a.stopped>5);message.errorCallback();sound.stopAll();const n=message.played;sound.resumeWelcome();assert.equal(message.played,n);
});
test('new voice files are bundled under 200KB and old cat recordings are removed',()=>{
 const dir=path.join(__dirname,'../assets/sfx');for(const name of ['small-1','small-2','young-1','young-2','teen','adult-boy','adult-girl','hungry','purr','message']){const n=fs.statSync(path.join(dir,'voice-'+name+'.mp3')).size;assert.ok(n>1000&&n<200*1024);}for(const name of ['cat-baby-4.wav','cat-feed-3.wav','cat-touch-1.wav','cat-touch-2.wav'])assert.equal(fs.existsSync(path.join(dir,name)),false);
});
