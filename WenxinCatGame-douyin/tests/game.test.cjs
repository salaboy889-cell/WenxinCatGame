const test=require('node:test'),assert=require('node:assert/strict');
const config=require('../config'),storage=new Map();config.cloudEnv='';let cloudCalls=0;
global.tt={getStorageSync:k=>storage.get(k),setStorageSync:(k,v)=>storage.set(k,JSON.parse(JSON.stringify(v))),removeStorageSync:k=>storage.delete(k)};
const {CatGame}=require('../js/game'),api=require('../js/service');
const canvas={getContext:()=>({})};
test('missing HTTP configuration never silently falls back to local storage',async()=>{
 const before=JSON.stringify([...storage]);config.cloudEnv='douyin-http';
 try{await assert.rejects(api.call('action',{action:'pet',payload:{}}),/HTTPS/);assert.equal(JSON.stringify([...storage]),before);}finally{config.cloudEnv='';}
});
test('local care persists, private pages reject visitors, companion stays bounded and dragging does not feed or pet',async()=>{
 const g=new CatGame(canvas,390,844);g.setSnapshot(await api.getHome());const first=g.data.active.growth;await g.act('pet');assert.equal(g.data.active.growth,first+2);g.setSnapshot(await api.getHome());assert.equal(g.data.active.growth,first+2);
 g.summon();for(let i=0;i<500;i++)g.update(.04,Date.now()+i*40);assert.ok(g.companion.x>=0&&g.companion.x<=294);assert.ok(g.companion.y>=96&&g.companion.y<=694);
 let actions=0;g.act=async()=>actions++;g.touchStart({clientX:g.companion.x+20,clientY:g.companion.y+20});g.touchMove({clientX:60,clientY:180});g.touchEnd({clientX:60,clientY:180});assert.equal(actions,0);
 const snap=await api.getHome();g.page='memories';g.setSnapshot({...snap,role:'guest'});assert.equal(g.page,'home');assert.equal(g.memories(100),100);assert.equal(g.us(100),100);
});
test('fish round is abandoned on hide, and card reward only follows a completed game',()=>{
 const g=new CatGame(canvas,390,844);g.fishGame={score:8};g.hide();assert.equal(g.fishGame,null);
 let rewarded=0;g.saveMatch=async()=>{assert.ok(g.pendingMatch.moves>=6);assert.ok(g.pendingMatch.requestId);rewarded++;};g.cards={values:[0,0,1,1,2,2,3,3,4,4,5,5],open:[],matched:[],moves:0};g.flip(0);assert.equal(rewarded,0);for(let i=1;i<12;i++)g.flip(i);assert.equal(rewarded,1);assert.equal(g.cards,null);
});

test('horizontal baby strip swipes without scrolling page or selecting a clipped card',async()=>{
 const g=new CatGame(canvas,390,844);g.setSnapshot(await api.getHome());g.babyStrip={x:25,y:300,w:330,h:140,max:250};g.babyOffset=0;
 g.touchStart({clientX:220,clientY:340});g.touchMove({clientX:100,clientY:346});g.touchEnd({clientX:100,clientY:346});assert.equal(g.babyOffset,120);assert.equal(g.scroll,0);
 g.ui.scroll=200;g.ui.hitClip={x:25,y:300,w:330,h:140};g.ui.hit(10,530,70,30,()=>{});assert.equal(g.ui.find(15,335),null);assert.equal(typeof g.ui.find(35,335),'function');
});
test('unsaved catch result retains the same receipt key after a network failure',async()=>{
 const g=new CatGame(canvas,390,844);g.pendingCatch={score:9,requestId:'same-receipt'};const action=api.action;let attempts=0;
 api.action=async(kind,payload,id)=>{attempts++;assert.equal(kind,'catch');assert.equal(id,'same-receipt');if(attempts===1)throw Error('network');return {...await api.getHome(),message:'saved'};};
 try{await assert.rejects(g.saveCatch(),/network/);assert.ok(g.pendingCatch);await g.saveCatch();assert.equal(g.pendingCatch,null);}finally{api.action=action;}
});
test('render cache reuses static layout, invalidates on scroll and snapshot, and never remeasures unchanged text',async()=>{
 const {getApp}=require('../js/runtime');const metrics={measure:0,baseText:0,screenImages:0};
 const context=layer=>({clearRect(){},fillRect(){},beginPath(){},moveTo(){},arcTo(){},closePath(){},fill(){},stroke(){},save(){},restore(){},rect(){},clip(){},translate(){},scale(){},ellipse(){},fillText(){if(layer)metrics.baseText++;},measureText(s){metrics.measure++;return {width:String(s).length*7};},drawImage(){if(!layer)metrics.screenImages++;}});
 const main=context(false),back=context(true),screen={width:780,height:1688,getContext:()=>main};const previousImage=tt.createImage,previousCanvas=tt.createOffscreenCanvas;
 tt.createOffscreenCanvas=()=>({getContext:()=>back});tt.createImage=()=>({width:128,height:128,set src(value){if(this.onload)this.onload();}});
 try{const g=new CatGame(screen,390,844);g.setSnapshot(await api.getHome());g.draw(0);g.draw(16);const measure=metrics.measure,text=metrics.baseText;for(let i=2;i<22;i++)g.draw(i*16);assert.equal(metrics.measure,measure);assert.equal(metrics.baseText,text);assert.ok(metrics.screenImages>=20);
  g.scroll=100;g.draw(400);assert.ok(metrics.baseText>text);g.setSnapshot(getApp().globalData.snapshot);const before=metrics.baseText;g.draw(416);assert.ok(metrics.baseText>before);
  g.page='memories';g.scroll=0;g.draw(432);g.draw(448);const draws=metrics.screenImages;g.draw(464);assert.equal(metrics.screenImages,draws);
 }finally{tt.createImage=previousImage;tt.createOffscreenCanvas=previousCanvas;}
});

test('vertical swipe coasts, slows, clamps to edges and never activates a button after returning to its start',()=>{
 const g=new CatGame(canvas,390,844);g.maxScroll=2000;let clicks=0;g.ui.find=()=>()=>clicks++;
 g.touchStart({clientX:100,clientY:600});g.touchMove({clientX:100,clientY:450});g.touchEnd({clientX:100,clientY:450});
 assert.ok(g.scrollVelocity>0);const before=g.scroll,velocity=g.scrollVelocity;g.update(.016,Date.now());assert.ok(g.scroll>before);assert.ok(g.scrollVelocity<velocity);assert.equal(clicks,0);
 g.touchStart({clientX:100,clientY:400});assert.equal(g.scrollVelocity,0);g.touchMove({clientX:100,clientY:350});g.touchMove({clientX:100,clientY:400});g.touchEnd({clientX:100,clientY:400});assert.equal(clicks,0);
 g.scroll=1999;g.scrollVelocity=2000;g.update(.016,Date.now());assert.equal(g.scroll,2000);assert.equal(g.scrollVelocity,0);g.hide();assert.equal(g.scrollVelocity,0);
});
test('entry meow plays once per occupied room entry, not on saves or polling; empty rooms stay quiet',async()=>{
 const sound=require('../js/sound'),original=sound.playWelcome;let calls=0;sound.playWelcome=()=>calls++;
 try{const snapshot=await api.getHome(),g=new CatGame(canvas,390,844);g.setSnapshot({...snapshot,roomId:'first'});assert.equal(calls,1);g.setSnapshot({...snapshot,roomId:'first'});assert.equal(calls,1);
 g.setSnapshot({...snapshot,roomId:'second'});assert.equal(calls,2);g.hide();await g.show({});assert.equal(calls,3);
 const empty=JSON.parse(JSON.stringify(snapshot));empty.home.family.parents=[];empty.home.family.kittens=[];const blank=new CatGame(canvas,390,844);blank.setSnapshot({...empty,roomId:'empty'});assert.equal(calls,3);
 }finally{sound.playWelcome=original;}
});
test('cat interactions meow immediately once, including story choices and rejected care, while room settings stay quiet',async()=>{
 const sound=require('../js/sound'),oldSound=sound.playMeow,oldAction=api.action;const calls=[];sound.playMeow=(cat,action)=>calls.push({cat,action});
 try{const g=new CatGame(canvas,390,844);g.setSnapshot(await api.getHome());api.action=async()=>{throw Error('not saved');};
 for(const action of ['feed','pet','sleep','daily_story','family_help','care_nest','welcome_kittens','shop']){const before=calls.length,promise=g.act(action);assert.equal(calls.length,before+1);await assert.rejects(promise,/not saved/);assert.equal(calls.length,before+1);}
 const before=calls.length;await assert.rejects(g.act('settings'),/not saved/);assert.equal(calls.length,before);
 }finally{sound.playMeow=oldSound;api.action=oldAction;}
});
test('chat portrait follows the selected cat, preserving breed, outfit and sleeping state',async()=>{
 const g=new CatGame(canvas,390,844);g.setSnapshot(await api.getHome());const seen=[];g.ui={cat:cat=>seen.push(cat),text(){},box(){},stroke(){},ellipse(){},pill(){},button(){},hit(){},wrap(){}};g.pageHeading=y=>y;
 const first=g.data.cats[0],second=g.data.cats.find(c=>c.id!==first.id);g.data.active=first;g.chat(100,0);assert.equal(seen.at(-1).id,first.id);
 g.data.active={...second,sleeping:true,outfit:'bow'};g.chat(100,16);assert.equal(seen.at(-1).id,second.id);assert.equal(seen.at(-1).sleeping,true);assert.equal(seen.at(-1).outfit,'bow');assert.deepEqual(seen.at(-1).breed,second.breed);
});
test('foster screen refreshes when async list arrives and distinguishes an empty shelter from a cat awaiting consent',async()=>{
 const g=new CatGame(canvas,390,844);g.setSnapshot(await api.getHome());g.page='foster';const pending=g.renderKey(0);g.fosters={mine:[],offers:[],publicCats:[],nextOffset:null};assert.notEqual(g.renderKey(0),pending);
 const labels=[],buttons=[],cats=[];g.ui={text:s=>labels.push(s),wrap:s=>labels.push(s),cat:c=>cats.push(c),box(){},stroke(){},ellipse(){},bar(){},button:s=>buttons.push(s)};g.pageHeading=y=>y;
 g.foster(100,0);assert.ok(labels.some(s=>s.includes('暂时没有寄养的小猫')));assert.equal(cats.length,0);
 g.fosters.publicCats=[{id:'pending-cat',cat:g.data.cats[0],state:'foster',mine:false}];const before=g.renderKey(0);labels.length=0;buttons.length=0;g.foster(100,0);assert.equal(cats.length,1);assert.ok(labels.some(s=>s.includes('暂不能领走')));assert.equal(buttons.includes('领回我的小屋'),false);
 g.fosters.publicCats[0].state='public';assert.notEqual(g.renderKey(0),before);g.foster(100,0);assert.equal(buttons.includes('领回我的小屋'),true);
});
test('unconfigured ads hide the quota panel and ad controls; only a completed rewarded video requests a reward',async()=>{
 const ads=require('../js/rewarded-ad'),previousId=config.rewardedAdUnitId,previousCloud=config.cloudEnv,previousCreate=tt.createRewardedVideoAd,originalCall=api.call;let close,ended=false,claims=0;const labels=[];
 try{
 config.rewardedAdUnitId='';const g=new CatGame(canvas,390,844);g.setSnapshot(await api.getHome());g.ui={text:s=>labels.push(s),wrap:s=>labels.push(s),pill(){},box(){},stroke(){},button:s=>labels.push(s),image(){},hit(){},lines:()=>1};g.pageHeading=y=>y;g.games(100);assert.equal(labels.includes('今日小游戏奖励'),false);assert.equal(labels.some(s=>s.includes('看广告')),false);
 config.rewardedAdUnitId='adunit-client-test';config.cloudEnv='configured-test-env';tt.createRewardedVideoAd=()=>({onClose:fn=>close=fn,onError(){},show:async()=>{close({isEnded:ended});},load:async()=>{}});assert.equal(ads.enabled(),true);
 const snapshot=require('../js/runtime').getApp().globalData.snapshot;api.call=async method=>{if(method==='adTicket')return {ticket:'test-ticket'};if(method==='claimAdReward'){claims++;return {...snapshot,adsReady:true,message:'小鱼干 +20'};}throw Error('unexpected method');};
 await g.watchAd('fish');assert.equal(claims,0);ended=true;await g.watchAd('fish');assert.equal(claims,1);
 labels.length=0;g.games(100);assert.equal(labels.includes('今日小游戏奖励'),true);
 }finally{config.rewardedAdUnitId=previousId;config.cloudEnv=previousCloud;tt.createRewardedVideoAd=previousCreate;api.call=originalCall;}
});
test('baby room shows a three-column grid, filters by sex and breed, and keeps visitor adoption separate from owner gifting',async()=>{
 const {catView}=require('../js/view'),{makeCat}=require('../js/rules/cat-family'),{breeds}=require('../js/rules/cat-breeds');const g=new CatGame(canvas,390,844);g.setSnapshot(await api.getHome());g.data.kittens=breeds.map((breed,i)=>catView({...makeCat('grid-'+i,breed.coat+'宝宝',i%2?'girl':'boy','2026-10-15',1),breedId:breed.id}));g.data.role='guest';g.data.hasOwnHome=true;g.data.adoption={credits:3};
 const rendered=[],buttons=[],boxes=[];g.ui={cat:c=>rendered.push(c),button:(label,x,y,w)=>buttons.push(label),box:(x,y,w)=>boxes.push({x,y,w}),stroke(){},text(){},wrap(){},pill(){},bar(){},hit(){},lines:()=>2};g.pageHeading=y=>y;
 g.babyRoom(100,0);assert.equal(rendered.length,40);assert.equal(new Set(boxes.filter(b=>b.w<150).map(b=>Math.round(b.x))).size,3);assert.equal(buttons.filter(s=>s==='领养这只').length,40);assert.equal(buttons.includes('赠送小猫'),false);
 rendered.length=0;g.babySexFilter='girl';g.babyRoom(100,0);assert.equal(rendered.length,20);assert.ok(rendered.every(c=>c.sex==='girl'));
 rendered.length=0;g.babySexFilter='';g.breedFilter=breeds[0].id;g.babyRoom(100,0);assert.equal(rendered.length,1);assert.equal(rendered[0].breed.id,breeds[0].id);
 buttons.length=0;g.data.role='me';g.babyRoom(100,0);assert.equal(buttons.includes('领养这只'),false);assert.equal(buttons.includes('赠送小猫'),true);
 g.page='babies';g.navigate('diary');assert.equal(g.diaryReturn,'babies');g.page='home';g.navigate('diary');assert.equal(g.diaryReturn,'home');
});
test('home chats use a resident parent and baby-room chats send the selected baby identity',async()=>{
 const g=new CatGame(canvas,390,844),snapshot=await api.getHome();g.setSnapshot(snapshot);const baby=g.data.kittens[0];g.page='babies';g.select(baby.id);g.navigate('chat');assert.equal(g.chatReturn,'babies');assert.equal(g.data.active.id,baby.id);
 const original=api.call,payloads=[];api.call=async(method,payload)=>method==='chatStatus'?{ready:true,viewerKey:'chat-context-test'}:method==='chatSend'?(payloads.push(payload),{reply:'喵'}):(()=>{throw Error('unexpected');})();g.refresh=async()=>{};
 try{g.chatDraft='你好';await g.sendChat();assert.equal(payloads[0].catId,baby.id);g.navigate('home');assert.ok(g.data.parents.some(c=>c.id===g.data.active.id));g.navigate('chat');assert.equal(g.chatReturn,'home');g.chatDraft='你好';await g.sendChat();assert.equal(payloads[1].catId,g.data.parents[0].id);}finally{api.call=original;}
});


test('adaptive sync preserves paired cadence and backs off idle or failed reads',()=>{
 const {interval}=require('../js/sync-policy');assert.equal(interval({paired:true,role:'me'},0,200000),20000);assert.equal(interval({role:'guest'},100000,120000),60000);assert.equal(interval({role:'guest'},0,120000),120000);assert.equal(interval({role:'me'},0,120000,4),300000);
});
test('background polling skips hidden, busy and overlapping requests',async()=>{
 const g=new CatGame(canvas,390,844);g.data={paired:true,role:'me'};g.lastActivity=0;g.lastSyncAt=0;let count=0,release;
 g.refresh=async()=>{count++;await new Promise(r=>release=r);};
 g.visible=false;await g.poll(30000);assert.equal(count,0);g.visible=true;g.busy=true;await g.poll(30000);assert.equal(count,0);g.busy=false;
 const pending=g.poll(30000);await g.poll(30001);assert.equal(count,1);release();await pending;await g.poll(40000);assert.equal(count,1);assert.equal(g.syncFailures,0);
});
test('unchanged snapshots avoid rebuilding the screen and resume triggers sync',async()=>{
 const g=new CatGame(canvas,390,844),original=api.getHome;g.data={roomId:'same',cats:[]};let count=0;
 api.getHome=async options=>{assert.equal(options.conditional,true);count++;return {unchanged:true};};
 try{await g.refresh({conditional:true});assert.equal(g._revision,0);g.hide();await g.show({});assert.equal(count,2);assert.equal(g._revision,0);}finally{api.getHome=original;}
});

test('partner mail survives decoration, appears on home and opens the shared collection inbox',async()=>{
 const s=await api.getHome();s.notifications=[{id:'mail-1',itemId:'letter-1',kind:'note',title:'小纸条',sender:'另一位',change:'created',read:false}];s.items=[{id:'letter-1',kind:'note',title:'小纸条',body:'回来陪猫玩',author:'you',created_at:new Date().toISOString()}];
 const g=new CatGame(canvas,390,844);g.setSnapshot(s);assert.equal(g.data.notifications.length,1);let opened=0;g.openInbox=()=>opened++;
 const u=g.ui;for(const name of ['box','stroke','text','image','imageCover','ellipse','bar','line','cat'])u[name]=()=>{};u.layout=text=>[text];u.lines=()=>1;u.wrap=(text,x,y)=>y+20;u.pill=(label,x,y,w,action)=>{if(action)u.hit(x,y,w,27,action);};u.button=()=>{};
 g.home(90,0);assert.ok(g.mailAnchor);const a=g.mailAnchor;u.find(a.x+4,a.y+4)();assert.equal(opened,1);assert.ok(g.inbox(90)>90);
 g.setSnapshot({...s,role:'guest'});assert.deepEqual(g.data.notifications,[]);
});

test('hunger sounds only on visible home, on an interval, and stop once fed',()=>{
 const sound=require('../js/sound'),old=sound.playMeow,calls=[],g=new CatGame(canvas,390,844);sound.playMeow=(cat,a)=>calls.push(a);g.data={cats:[{hunger:20,sleeping:false}]};g.nextHungerAt=100;
 try{g.ambientSound(100);assert.deepEqual(calls,['ambient']);g.ambientSound(101);assert.equal(calls.length,1);g.visible=false;g.ambientSound(50000);assert.equal(calls.length,1);g.visible=true;g.page='chat';g.ambientSound(50000);assert.equal(calls.length,1);g.page='home';g.data.cats[0].hunger=60;g.ambientSound(50000);assert.equal(calls.length,1);}finally{sound.playMeow=old;}
});
test('message sound is batched, persists across game instances and never plays for self or guests',()=>{
 const sound=require('../js/sound'),old=sound.playNotification;let count=0;sound.playNotification=()=>count++;
 try{const data={roomId:'test-sound-room',role:'me',notifications:[{id:'new-note-1',read:false},{id:'new-note-2',read:false}]},g=new CatGame(canvas,390,844);g.data=data;g.announceMessages();g.announceMessages();assert.equal(count,1);const second=new CatGame(canvas,390,844);second.data=data;second.announceMessages();assert.equal(count,1);second.data={...data,role:'guest'};second.announceMessages();assert.equal(count,1);g.data={...data,notifications:[]};g.announceMessages();assert.equal(count,1);}finally{sound.playNotification=old;}
});
test('care buttons still give sound feedback while an earlier save is pending',()=>{
 const sound=require('../js/sound'),old=sound.playMeow;let count=0;sound.playMeow=()=>count++;try{const g=new CatGame(canvas,390,844);g.busy=true;g.data={cats:[{id:'busy-cat'}],active:{id:'busy-cat'}};for(let i=0;i<4;i++)g.respond('pet');assert.equal(count,4);}finally{sound.playMeow=old;}
});

test('baby refresh visibly starts, reports unchanged data, and explains busy or failed requests',async()=>{
 const g=new CatGame(canvas,390,844);g.data={kittens:[{id:'one'}]};let release,calls=0;g.refresh=async options=>{assert.equal(options,undefined);calls++;await new Promise(r=>release=r);};
 const pending=g.refreshBabies();assert.equal(g.babyRefreshing,true);assert.match(g.notice,/正在刷新/);await g.refreshBabies();assert.equal(calls,1);release();await pending;assert.equal(g.babyRefreshing,false);assert.match(g.notice,/暂无新增或领走/);
 g.busy=true;await g.refreshBabies();assert.match(g.notice,/正在保存/);assert.equal(calls,1);g.busy=false;g.refresh=async()=>{throw Error('断网');};await g.refreshBabies();assert.match(g.notice,/刷新失败.*断网/);assert.equal(g.babyRefreshing,false);
 g.refresh=async()=>{g.data={kittens:[{id:'two'},{id:'three'}]};};await g.refreshBabies();assert.match(g.notice,/当前2只宝宝.*列表已更新/);
});

test('help filters creator-only and ads sections by current role and returns to its entry page',()=>{
 const {sections}=require('../js/help');const guest=sections({role:'guest',owner:true,isFounderNursery:true});assert.equal(guest.some(s=>s.id==='founder'),false);assert.equal(guest.some(s=>s.id==='memories'),false);assert.equal(guest.some(s=>s.id==='ads'),false);assert.ok(guest.find(s=>s.id==='start').body.includes('3次'));assert.ok(guest.find(s=>s.id==='grow').body.includes('800'));
 assert.ok(sections({role:'me',owner:true,isFounderNursery:true}).some(s=>s.id==='founder'));assert.equal(sections({role:'you',owner:false,isFounderNursery:true}).some(s=>s.id==='founder'),false);assert.ok(sections({role:'me'},true).some(s=>s.id==='ads'));
 const g=new CatGame(canvas,390,844);g.page='us';g.openHelp();assert.equal(g.page,'help');assert.equal(g.helpReturn,'us');assert.equal(g.helpOpen,'start');g.page='home';g.openHelp();assert.equal(g.helpReturn,'home');
});
