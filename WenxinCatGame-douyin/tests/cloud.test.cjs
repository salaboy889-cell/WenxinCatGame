const test=require('node:test'),assert=require('node:assert/strict');
const {createHandler,collections}=require('../server/core');
const {initialHome,dayKey}=require('../server/rules/home-state');
const clone=x=>JSON.parse(JSON.stringify(x));
function fixture(options={}){
 const stats={writes:0,transactions:0};const data=new Map(),files=new Map(),deleted=[];let queue=Promise.resolve(),fileCount=0,urlFailures=0,urlCalls=0,clock=Date.parse(dayKey()+'T04:00:00Z');
 const accessor=store=>({collection(name){return {where(filters){let skip=0,limit=20;const query={skip(n){skip=n;return query;},limit(n){limit=n;return query;},async get(){return {data:[...store].filter(([key,value])=>key.startsWith(name+':')&&Object.entries(filters).every(([field,expected])=>value[field]===expected)).slice(skip,skip+limit).map(([,value])=>clone(value))};}};return query;},doc(id){const key=name+':'+id;return {async get(){return {data:store.has(key)?{...clone(store.get(key)),_id:id,_openid:'system-owner'}:[]};},async set({data:value}){stats.writes++;if('_id' in value||'_openid' in value)throw Error('Cannot write system document fields');store.set(key,clone(value));},async remove(){store.delete(key);}};}};}});
 const db={...accessor(data),async runTransaction(fn){stats.transactions++;const earlier=queue;let release;queue=new Promise(r=>release=r);await earlier;const draft=new Map(Array.from(data,([k,v])=>[k,clone(v)]));try{const result=await fn(accessor(draft));data.clear();for(const [k,v] of draft)data.set(k,v);return result;}finally{release();}}};
 const storage={async uploadFile({fileContent}){const fileID='cloud://private/'+(++fileCount);files.set(fileID,fileContent);return {fileID};},async getTempFileURL({fileList}){urlCalls++;if(urlFailures){urlFailures--;throw Error('temporary URL unavailable');}return {fileList:fileList.map(fileID=>({fileID,status:0,tempFileURL:'https://private.example/'+fileID}))};},async deleteFile({fileList}){for(const id of fileList){deleted.push(id);files.delete(id);}return {fileList:[]};}};
 const call=createHandler({db,storage,now:()=>clock,getProvider:()=> 'openai',...options});
 return {call,data,files,deleted,stats,resetStats(){stats.writes=0;stats.transactions=0;},urlCalls(){return urlCalls;},failURL(){urlFailures++;},advance(ms){clock+=ms;},room(id){return data.get(collections.rooms+':'+id);},async approvedJoin(code,uid){const preview=await call({method:'joinPreview',code},uid);return call({method:'joinRoom',code,acceptResidentCats:true,consentToken:preview.consentToken},uid);},async pair(){const me=await call({method:'createRoom'},'owner'),invite=await call({method:'invite'},'owner');const preview=await call({method:'joinPreview',code:invite.code},'partner');await call({method:'joinRoom',code:invite.code,acceptResidentCats:true,consentToken:preview.consentToken},'partner');return me.roomId;},action(uid,action,payload={},requestId='req-'+require('node:crypto').randomUUID(),visitRoom=''){return call({method:'action',action,payload,requestId,visitRoom},uid);}};
}
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+XWfoAAAAASUVORK5CYII=','base64').toString('base64');
test('shop purchase, equip, persistence and removal affect only the selected cat and use dressed animation assets',async()=>{
 const f=fixture(),id=await f.pair();
 const worn=await f.action('owner','shop',{id:'scarf',catId:'cat-girl'});assert.equal(worn.home.coins,65);assert.equal(worn.home.family.parents[1].outfit,'scarf');assert.equal(worn.home.family.parents[0].outfit,'none');
 const peer=await f.call({method:'getHome'},'partner');assert.equal(peer.home.family.parents[1].outfit,'scarf');
 await f.action('partner','sleep',{catId:'cat-girl'});const {catView}=require('../js/view');assert.equal(catView(f.room(id).home.family.parents[1]).asset,'/assets/cat-girl-real-scarf-sleep.png');
 await f.action('owner','shop',{id:'bow',catId:'cat-boy'});assert.equal(f.room(id).home.family.parents[0].outfit,'bow');assert.equal(f.room(id).home.family.parents[1].outfit,'scarf');
 await f.action('owner','shop',{id:'none',catId:'cat-girl'});const coins=f.room(id).home.coins;assert.equal(f.room(id).home.family.parents[1].outfit,'none');assert.equal(f.room(id).home.family.parents[0].outfit,'bow');
 await f.action('partner','shop',{id:'scarf',catId:'cat-girl'});assert.equal(f.room(id).home.coins,coins);assert.equal(f.room(id).home.owned.filter(item=>item==='scarf').length,1);assert.equal(catView(f.room(id).home.family.parents[1]).sprite,'/assets/cat-girl-real-scarf-atlas.png');
});
test('same-day growth is capped for normal care and completed ad boosts, shared by both owners',async()=>{
 const f=fixture(),id=await f.pair(),room=f.room(id),baby={...room.home.family.parents[0],id:'same-day-baby',generation:1,bornOn:dayKey(),growth:0,careXp:0,boostCount:0};room.home.family.kittens.push(baby);
 for(let i=0;i<40;i++)await f.action(i%2?'owner':'partner','pet',{catId:baby.id});
 assert.equal(f.room(id).home.family.kittens[0].growth,60);assert.equal(f.room(id).home.family.kittens[0].careXp,60);
 const old=process.env.MW_REWARDED_AD_UNIT_ID;process.env.MW_REWARDED_AD_UNIT_ID='adunit-test';
 try{
  for(let i=0;i<3;i++){
   const {ticket}=await f.call({method:'adTicket',purpose:'growth',catId:baby.id},'owner');
   assert.equal(f.room(id).home.family.kittens[0].growth,60+i*30);
   await assert.rejects(f.call({method:'claimAdReward',ticket},'owner'),error=>error.code==='AD_INVALID');
   f.advance(6000);await f.call({method:'claimAdReward',ticket,purpose:'fish'},'owner');
   await assert.rejects(f.call({method:'claimAdReward',ticket},'owner'),error=>error.code==='AD_INVALID');
  }
  const grown=f.room(id).home.family.kittens[0];assert.equal(grown.growth,150);assert.equal(require('../server/rules/cat-family').stageIndex(grown,dayKey()),1);assert.equal(f.room(id).home.coins,120);
  await assert.rejects(f.call({method:'adTicket',purpose:'growth',catId:baby.id},'partner'),error=>error.code==='BOOST_LIMIT');
  f.room(id).home.family.kittens.push({...baby,id:'capped-baby',growth:0,careXp:0,boostCount:0});
  for(let i=0;i<3;i++){const {ticket}=await f.call({method:'adTicket',purpose:'growth',catId:'capped-baby'},'partner');f.advance(6000);await f.call({method:'claimAdReward',ticket},'partner');}
  await assert.rejects(f.call({method:'adTicket',purpose:'growth',catId:'capped-baby'},'owner'),error=>error.code==='BOOST_LIMIT');
  await assert.rejects(f.call({method:'adTicket',purpose:'growth',catId:'capped-baby',visitRoom:id},'guest'),error=>error.code==='FORBIDDEN');
 }finally{if(old===undefined)delete process.env.MW_REWARDED_AD_UNIT_ID;else process.env.MW_REWARDED_AD_UNIT_ID=old;}
});
test('extra litters need exclusive ad milk, fresh care, slots and healthy parents on the same day',async()=>{
 const f=fixture(),id=await ordinaryPair(f),old=process.env.MW_REWARDED_AD_UNIT_ID;process.env.MW_REWARDED_AD_UNIT_ID='adunit-test';
 try{
  await assert.rejects(f.call({method:'adTicket',purpose:'nursery'},'owner'),error=>error.code==='BAD_INPUT');
  for(let i=0;i<12;i++)await f.action('owner','family_help');const first=f.room(id).home.family.kittens.length;assert.ok(first>=1&&first<=2);assert.equal(f.room(id).home.family.birthCount,1);
  for(let i=0;i<12;i++)await f.action('owner','family_help');assert.equal(f.room(id).home.family.kittens.length,first);assert.equal(f.room(id).home.family.feedingProgress,12);
  async function milk(){const {ticket}=await f.call({method:'adTicket',purpose:'nursery'},'owner');f.advance(6000);await f.call({method:'claimAdReward',ticket},'owner');}
  await milk();await f.action('owner','family_help');const second=f.room(id).home.family.kittens.length;assert.ok(second>first);assert.ok(second<=4);assert.equal(f.room(id).home.family.nurseryMilk,0);
  for(let i=0;i<12;i++)await f.action('owner','family_help');await milk();assert.equal(f.room(id).home.family.kittens.length,second);assert.ok(f.room(id).home.family.parents.every(cat=>cat.hunger<40));
  for(const catId of ['cat-boy','cat-girl'])await f.action('owner','feed',{catId});assert.ok(f.room(id).home.family.kittens.length>second);assert.ok(f.room(id).home.family.kittens.length<=6);
  const before=(await f.call({method:'getHome'},'owner')).home.coins;await f.action('owner','sleep',{catId:'cat-boy'});assert.equal((await f.call({method:'getHome'},'owner')).home.coins,before-3);await f.action('owner','sleep',{catId:'cat-boy'});assert.equal((await f.call({method:'getHome'},'owner')).home.coins,before-3);
 }finally{if(old===undefined)delete process.env.MW_REWARDED_AD_UNIT_ID;else process.env.MW_REWARDED_AD_UNIT_ID=old;}
});
test('nursery ads reserve only three room rewards, do not replace adoption care, and expire daily',async()=>{
 const f=fixture(),id=await ordinaryPair(f),old=process.env.MW_REWARDED_AD_UNIT_ID;process.env.MW_REWARDED_AD_UNIT_ID='adunit-test';
 try{
  for(let i=0;i<12;i++)await f.action('owner','family_help');
  const viewers=['a','b','c'],tickets=[];for(const uid of viewers)tickets.push((await f.call({method:'adTicket',purpose:'nursery',visitRoom:id},uid)).ticket);
  await assert.rejects(f.call({method:'adTicket',purpose:'nursery',visitRoom:id},'d'),error=>error.code==='AD_LIMIT');
  f.advance(6000);for(let i=0;i<3;i++){const reward=await f.call({method:'claimAdReward',ticket:tickets[i],visitRoom:id},viewers[i]);assert.equal(reward.adoption.credits,0);assert.equal(reward.home.coins,15);}
  assert.equal(f.room(id).home.family.nurseryMilk,3);assert.equal(f.room(id).home.family.milkAdsCount,3);
  await assert.rejects(f.call({method:'adTicket',purpose:'nursery',visitRoom:id},'d'),error=>error.code==='AD_LIMIT');
  const {normalizeFamily}=require('../server/rules/cat-family'),tomorrow=dayKey(new Date(Date.now()+86400000)),next=normalizeFamily(clone(f.room(id).home),tomorrow);assert.equal(next.family.nurseryMilk,0);assert.equal(next.family.birthCount,0);assert.equal(next.family.milkAdsCount,0);
 }finally{if(old===undefined)delete process.env.MW_REWARDED_AD_UNIT_ID;else process.env.MW_REWARDED_AD_UNIT_ID=old;}
});
async function adoptAndPair(f){
 const source=await f.pair();for(const [uid,sex] of [['one','boy'],['two','girl']]){
  f.room(source).home.family.kittens.push({...f.room(source).home.family.parents[sex==='boy'?0:1],id:'cat-'+uid,sex,generation:1,bornOn:dayKey(),growth:0,careXp:0});
  for(let i=0;i<3;i++)await f.action(uid,'family_help',{},undefined,source);await adoptCreatedHome(f,{method:'adoptCat',sourceRoomId:source,sex},uid);
 }
 const invite=await f.call({method:'invite'},'one'),joined=await f.approvedJoin(invite.code,'two');return {source,id:joined.roomId};
}
test('invited partner can leave voluntarily, inviter can remove partner; only inviter keeps original room',async()=>{
 for(const [method,actor] of [['kickPartner','one'],['separateRoom','two']]){
  const f=fixture(),{id}=await adoptAndPair(f),room=f.room(id);
  room.home.family.kittens.push({...room.home.family.parents[0],id:'shared-baby',generation:2,growth:0});
  await f.call({method:'saveMemory',requestId:'req-split-private',payload:{kind:'photo',title:'共同照片',imageBase64:png}},'two');
  const before=(await f.call({method:'getHome'},'one')).home.coins+(await f.call({method:'getHome'},'two')).home.coins;
  await assert.rejects(f.call({method:'kickPartner'},'two'),error=>error.code==='FORBIDDEN');
  await assert.rejects(f.call({method:'separateRoom'},'one'),error=>error.code==='FORBIDDEN');
  await assert.rejects(f.call({method:'leaveRoom'},'two'),error=>error.code==='FORBIDDEN');
  assert.equal((await f.call({method:'getHome'},'two')).roomId,id);
  const triggered=await f.call({method},actor);assert.equal(triggered.role,'me');assert.equal(triggered.paired,false);
  const inviter=await f.call({method:'getHome'},'one'),invited=await f.call({method:'getHome'},'two');
  assert.equal(inviter.roomId,id);assert.notEqual(invited.roomId,id);assert.deepEqual(inviter.home.family.parents.map(cat=>cat.id),['cat-one']);assert.equal(inviter.home.family.kittens.length,0);assert.equal(inviter.items[0].title,'共同照片');
  assert.deepEqual(invited.home.family.parents.map(cat=>cat.id),['cat-two']);assert.equal(invited.items.length,0);assert.equal(invited.home.coins+inviter.home.coins,before);
  const firstFosters=await f.call({method:'fosterList'},'one'),secondFosters=await f.call({method:'fosterList'},'two');assert.equal(firstFosters.mine[0].cat.id,'shared-baby');assert.equal(secondFosters.mine[0].cat.id,'shared-baby');assert.equal(firstFosters.mine[0].id,secondFosters.mine[0].id);
  assert.equal(triggered.roomId,actor==='one'?inviter.roomId:invited.roomId);
  const oldView=await f.call({method:'getHome',visitRoom:id},'two');assert.equal(oldView.items.length,0);assert.deepEqual(oldView.myCatIds,[]);
 }
});
test('disputed shared kitten is fostered in founder room; visitors can help but only both old guardians can open adoption',async()=>{
 const f=fixture(),id=await f.pair();f.room(id).home.family.kittens.push({...f.room(id).home.family.parents[0],id:'joint-kitten',name:'一起养的猫',generation:1,growth:10,hunger:60,careXp:0});
 await f.call({method:'separateRoom'},'partner');
 const a=await f.call({method:'fosterList'},'owner'),b=await f.call({method:'fosterList'},'partner'),fosterId=a.mine[0].id;
 assert.equal(b.mine[0].id,fosterId);assert.equal((await f.call({method:'fosterList'},'visitor')).publicCats[0].cat.name,'一起养的猫');
 assert.equal((await f.call({method:'getHome'},'partner')).items.length,0);
 await assert.rejects(f.call({method:'fosterAdopt',fosterId},'visitor'),error=>error.code==='NOT_FOUND');
 await assert.rejects(f.call({method:'fosterProposal',fosterId,kind:'public'},'visitor'),error=>error.code==='FORBIDDEN');
 const petted=await f.call({method:'fosterCare',fosterId,action:'pet'},'visitor');assert.ok(petted.cat.growth>10);
 await f.call({method:'fosterProposal',fosterId,kind:'public'},'owner');
 assert.equal((await f.call({method:'fosterList'},'visitor')).publicCats[0].state,'foster');
 await f.call({method:'fosterProposal',fosterId,kind:'public'},'partner');
 assert.equal((await f.call({method:'fosterList'},'visitor')).publicCats[0].state,'public');
 await f.call({method:'createRoom'},'visitor');
 await assert.rejects(f.call({method:'fosterAdopt',fosterId},'visitor'),error=>error.code==='NOT_READY');
 for(let i=0;i<3;i++)await f.action('visitor','family_help',{},undefined,id);
 await f.call({method:'fosterAdopt',fosterId},'visitor');assert.equal((await f.call({method:'getHome'},'visitor')).home.family.parents[0].id,'joint-kitten');
 assert.equal((await f.call({method:'fosterList'},'owner')).mine.length,0);
 await assert.rejects(f.call({method:'fosterAdopt',fosterId},'another'),error=>error.code==='NOT_FOUND');
});
test('new housemate does not inherit old shared cat and can decline or accept only after both guardians approve',async()=>{
 const f=fixture(),id=await f.pair();f.room(id).home.family.kittens.push({...f.room(id).home.family.parents[0],id:'old-shared-kitten',generation:1});
 await f.call({method:'kickPartner'},'owner');await f.call({method:'createRoom'},'newPartner');const code=(await f.call({method:'invite'},'owner')).code;await f.approvedJoin(code,'newPartner');
 const fosterId=(await f.call({method:'fosterList'},'partner')).mine[0].id;
 assert.equal(f.room(id).home.family.kittens.length,0);assert.equal((await f.call({method:'fosterList'},'newPartner')).mine.length,0);
 await assert.rejects(f.call({method:'fosterAccept',fosterId},'newPartner'),error=>error.code==='FORBIDDEN');
 await f.call({method:'fosterProposal',fosterId,kind:'newPartner',side:'first'},'owner');
 await assert.rejects(f.call({method:'fosterAccept',fosterId},'newPartner'),error=>error.code==='NOT_READY');
 assert.equal((await f.call({method:'fosterList'},'newPartner')).offers.length,1);
 await f.call({method:'fosterDecline',fosterId},'newPartner');assert.equal((await f.call({method:'fosterList'},'newPartner')).offers.length,0);
 await f.call({method:'fosterProposal',fosterId,kind:'newPartner',side:'first'},'partner');await f.call({method:'fosterProposal',fosterId,kind:'newPartner',side:'first'},'owner');
 await f.call({method:'fosterAccept',fosterId},'newPartner');assert.equal(f.room(id).catGuardians['old-shared-kitten'],'newPartner');assert.equal((await f.call({method:'fosterList'},'partner')).mine.length,0);
});
test('replacing an adopted cat resets old entitlement and requires three fresh care actions',async()=>{
 const f=fixture(),{source}=await adoptAndPair(f);
 for(let i=0;i<4;i++)await f.action('one','family_help',{},undefined,source);assert.equal((await f.call({method:'getHome',visitRoom:source},'one')).adoption.credits,4);
 const ended=await f.call({method:'releaseCat',catId:'cat-one'},'one');assert.equal(ended.home.family.parents.length,1);assert.equal(ended.home.family.parents[0].id,'cat-two');assert.equal((await f.call({method:'getHome',visitRoom:source},'one')).adoption.credits,0);
 f.room(source).home.family.kittens.push({...f.room(source).home.family.parents[1],id:'replacement-girl',generation:1,growth:0});
 await assert.rejects(f.call({method:'adoptCat',sourceRoomId:source,sex:'girl'},'one'),error=>error.code==='NOT_READY');
 await f.action('one','game',{moves:12},undefined,source);assert.equal((await f.call({method:'getHome',visitRoom:source},'one')).adoption.credits,0);for(let i=0;i<3;i++)await f.action('one','family_help',{},undefined,source);const replaced=await adoptCreatedHome(f,{method:'adoptCat',sourceRoomId:source,sex:'girl'},'one');assert.ok(replaced.myCatIds.includes('replacement-girl'));assert.equal(replaced.home.family.parents.every(cat=>cat.sex==='girl'),true);
 await assert.rejects(f.call({method:'releaseCat',catId:'cat-two'},'one'),error=>error.code==='FORBIDDEN');
});
test('legacy founder cats migrate once to adults, keep twelve care credits, and produce a first litter on the next help',async()=>{
 const f=fixture(),id=await f.pair();await f.call({method:'saveMemory',requestId:'req-migrate-photo',payload:{kind:'photo',title:'原照片',imageBase64:png}},'owner');
 const room=f.room(id);delete room.founderAdultRevision;room.home.family.feedingProgress=12;
 for(const cat of room.home.family.parents){cat.bornOn=dayKey();cat.growth=5;}
 const snapshot=await f.call({method:'getHome',visitRoom:id},'visitor');assert.equal(snapshot.home.family.feedingProgress,12);assert.ok(snapshot.home.family.parents.every(cat=>cat.growth>=800));assert.equal(snapshot.items.length,0);assert.equal(f.room(id).items[0].title,'原照片');
 const version=f.room(id).version;await f.call({method:'getHome'},'owner');assert.equal(f.room(id).version,version);
 const born=await f.action('visitor','family_help',{},undefined,id);assert.ok(born.home.family.kittens.length>=1);assert.equal(born.home.family.feedingProgress,0);
 const uid='adopter';for(let i=0;i<3;i++)await f.action(uid,'family_help',{},undefined,id);
 const sex=f.room(id).home.family.kittens[0].sex,adopted=await adoptCreatedHome(f,{method:'adoptCat',sourceRoomId:id,sex},uid);
 const babyBefore=clone(adopted.home.family.parents[0]);await f.call({method:'getHome'},uid);assert.deepEqual(f.room(adopted.roomId).home.family.parents[0],babyBefore);assert.ok(babyBefore.growth<800);
});
test('new users find the founder nursery without a friend link and enter with private guest permissions',async()=>{
 const f=fixture(),source=await f.pair();
 await f.call({method:'saveMemory',requestId:'req-founder-private',payload:{kind:'photo',title:'私人照片',imageBase64:png}},'owner');
 const entry=await f.call({method:'founderEntry'},'new-user');assert.deepEqual(entry,{roomId:source});
 const before=f.urlCalls(),visit=await f.call({method:'visitRoom',roomId:entry.roomId},'new-user');assert.equal(visit.role,'guest');assert.equal(visit.home.family.parents.length,2);assert.deepEqual(visit.items,[]);assert.equal(f.urlCalls(),before);
 const own=await f.call({method:'createRoom'},'new-user');assert.equal(own.home.family.parents.length,0);
 assert.equal((await f.call({method:'founderEntry'},'new-user')).roomId,source);assert.equal(f.data.get(collections.users+':new-user').roomId,own.roomId);
 await f.call({method:'deleteRoom'},'owner');await assert.rejects(f.call({method:'founderEntry'},'new-user'),error=>error.code==='NO_FOUNDER');assert.ok(f.room(own.roomId));
});
test('four visitors fill a visible twelve-care nursery, trigger a baby and keep independent fish',async()=>{
 const f=fixture(),id=await f.pair();assert.equal((await f.call({method:'visitRoom',roomId:id},'helper-0')).home.coins,15);
 for(let i=0;i<4;i++)for(let j=0;j<3;j++){const s=await f.action('helper-'+i,'family_help',{},undefined,id);if(i<3||j<2)assert.equal(s.home.family.kittens.length,0);}
 const h=f.room(id).home;assert.ok(h.family.kittens.length>=1&&h.family.kittens.length<=2);assert.equal(h.family.feedingProgress,0);assert.equal(h.coins,120);
 for(let i=0;i<4;i++)assert.equal((await f.call({method:'getHome',visitRoom:id},'helper-'+i)).home.coins,9);
 const extra=await f.action('helper-0','family_help',{},undefined,id);assert.equal(extra.adoption.credits,4);assert.equal(extra.home.coins,7);
 const earned=await f.action('helper-0','game',{moves:12},undefined,id);assert.equal(earned.home.coins,27);assert.equal(f.room(id).home.coins,120);
 const another=await f.action('helper-1','game',{moves:12},undefined,id);assert.equal(another.home.coins,29);
});
test('one personal fish balance follows a user across rooms, new rooms and closing a room',async()=>{
 const f=fixture(),founder=await f.pair(),other=(await f.call({method:'createRoom'},'other')).roomId;
 assert.equal((await f.call({method:'visitRoom',roomId:founder},'traveler')).home.coins,15);
 await f.action('traveler','game',{moves:12},undefined,founder);
 assert.equal((await f.call({method:'visitRoom',roomId:other},'traveler')).home.coins,35);
 await f.action('traveler','game',{moves:12},undefined,other);
 assert.equal((await f.call({method:'getHome',visitRoom:founder},'traveler')).home.coins,55);
 const own=await f.call({method:'createRoom'},'traveler');assert.equal(own.home.coins,160);
 await f.action('traveler','family_help',{},undefined,founder);
 assert.equal((await f.call({method:'getHome'},'traveler')).home.coins,158);
 await f.action('traveler','game',{moves:12});assert.equal((await f.call({method:'getHome',visitRoom:other},'traveler')).home.coins,178);
 await f.call({method:'deleteRoom'},'traveler');assert.equal((await f.call({method:'visitRoom',roomId:founder},'traveler')).home.coins,178);
 assert.equal((await f.call({method:'createRoom'},'traveler')).home.coins,178);
 assert.equal((await f.call({method:'getHome'},'other')).home.coins,120);
});
test('legacy shared fish is divided once between the two people before individual spending',async()=>{
 const f=fixture(),id=await f.pair(),owner=f.data.get(collections.users+':owner'),partner=f.data.get(collections.users+':partner');
 delete owner.fishBalance;delete partner.fishBalance;f.room(id).home.coins=101;
 assert.equal((await f.call({method:'getHome'},'owner')).home.coins,51);
 assert.equal((await f.call({method:'getHome'},'partner')).home.coins,50);
 await f.action('owner','feed',{catId:'cat-boy'});
 assert.equal((await f.call({method:'getHome'},'owner')).home.coins,46);
 assert.equal((await f.call({method:'getHome'},'partner')).home.coins,50);
});
test('a full nursery still allows a new visitor to earn all three claim credits on the same day',async()=>{
 const f=fixture(),id=await f.pair(),home=f.room(id).home;
 home.family.feedingProgress=12;home.family.lastBirthAt=new Date().toISOString();
 for(let i=0;i<48;i++)home.family.kittens.push({...home.family.parents[0],id:'waiting-'+i,generation:1});
 for(let i=1;i<=3;i++){const result=await f.action('fresh-visitor','family_help',{},undefined,id);assert.equal(result.adoption.credits,i);assert.equal(result.home.family.feedingProgress,12);}
 const claimed=await adoptCreatedHome(f,{method:'adoptCat',sourceRoomId:id,sex:'boy'},'fresh-visitor');assert.equal(claimed.home.family.parents.length,1);
});
test('a visitor earns three care credits and directly claims an available kitten without approval',async()=>{
 const f=fixture(),source=await f.pair(),room=f.room(source);
 room.home.family.kittens.push({...room.home.family.parents[1],id:'little-girl',name:'小桃子',sex:'girl',generation:1,bornOn:dayKey(),growth:0,careXp:0,hunger:60});
 const visitor=await f.call({method:'visitRoom',roomId:source},'adopter');assert.equal(visitor.adoption.availableGirls,1);assert.equal(visitor.adoption.credits,0);
 await assert.rejects(f.call({method:'adoptCat',sourceRoomId:source,sex:'girl'},'adopter'),e=>e.code==='NOT_READY');
 for(let i=1;i<=3;i++){const fed=await f.action('adopter','family_help',{},undefined,source);assert.equal(fed.adoption.credits,i);}
 await assert.rejects(f.call({method:'adoptCat',sourceRoomId:source,sex:'boy'},'adopter'),e=>e.code==='NOT_FOUND');
 const event={method:'adoptCat',sourceRoomId:source,sex:'girl',requestId:'req-adoption-first'},adopted=await adoptCreatedHome(f,event,'adopter');assert.equal((await f.call(event,'adopter')).roomId,adopted.roomId);
 assert.equal(adopted.home.family.parents.length,1);assert.equal(adopted.home.family.parents[0].id,'little-girl');assert.equal(f.room(source).home.family.kittens.length,0);
 assert.equal(f.room(source).home.family.legacy[0].to,'一位访客');assert.equal(f.data.get(collections.users+':adopter').visitorWallets[source].helped,0);
 await assert.rejects(f.call({method:'adoptCat',sourceRoomId:source,sex:'girl'},'adopter'),e=>e.code==='NOT_FOUND');
 assert.equal((await f.call({method:'getHome'},'adopter')).roomId,adopted.roomId);
});
test('two independently adopted cats move into one room by partner code, preserving both cat identities',async()=>{
 const f=fixture(),source=await f.pair(),room=f.room(source),ago=dayKey(new Date(Date.now()-8*86400000));
 for(const [id,sex,uid] of [['baby-boy','boy','one'],['baby-girl','girl','two']]){
  f.room(source).home.family.kittens.push({...f.room(source).home.family.parents[sex==='boy'?0:1],id,name:id,sex,generation:1,bornOn:ago,growth:800,lastGrowthDay:dayKey()});
  for(let i=0;i<3;i++)await f.action(uid,'family_help',{},undefined,source);
  const adopted=await adoptCreatedHome(f,{method:'adoptCat',sourceRoomId:source,sex},uid);assert.equal(adopted.home.family.parents[0].id,id);
 }
 const old=f.data.get(collections.users+':two').roomId,target=f.data.get(collections.users+':one').roomId;
 const invite=await f.call({method:'invite'},'one');const joined=await f.approvedJoin(invite.code,'two');
 assert.equal(joined.roomId,target);assert.deepEqual(joined.home.family.parents.map(c=>c.id),['baby-boy','baby-girl']);assert.equal(f.room(old),undefined);assert.equal(joined.home.coins,114);assert.equal((await f.call({method:'getHome'},'one')).home.coins,114);
 assert.equal(f.data.get(collections.users+':two').roomId,target);assert.equal((await f.call({method:'getHome'},'two')).role,'you');
 await assert.rejects(f.call({method:'joinRoom',code:invite.code},'three'),e=>e.code==='BAD_INVITE');
 f.room(target).home.family.bond=30;f.room(target).home.family.nestBuilt=true;
 await f.action('one','start_litter');assert.deepEqual(f.room(target).home.family.pending.parentIds.sort(),['baby-boy','baby-girl'].sort());
});
test('two users can live with same-sex adopted cats but the cats cannot breed',async()=>{
 const f=fixture(),source=await f.pair(),ago=dayKey(new Date(Date.now()-8*86400000));
 for(const uid of ['first','second']){
  f.room(source).home.family.kittens.push({...f.room(source).home.family.parents[1],id:'girl-'+uid,sex:'girl',generation:1,bornOn:ago,growth:800,lastGrowthDay:dayKey()});
  for(let i=0;i<3;i++)await f.action(uid,'family_help',{},undefined,source);
  await adoptCreatedHome(f,{method:'adoptCat',sourceRoomId:source,sex:'girl'},uid);
 }
 const invite=await f.call({method:'invite'},'first'),joined=await f.approvedJoin(invite.code,'second');
 assert.ok(joined.home.family.parents.every(cat=>cat.sex==='girl'));
 f.room(joined.roomId).home.family.bond=30;f.room(joined.roomId).home.family.nestBuilt=true;
 await assert.rejects(f.action('first','start_litter'),/成年公猫和成年母猫/);
});
test('two owners can graduate an adult kitten to keep the six-slot nursery usable',async()=>{
 const f=fixture(),id=await f.pair(),room=f.room(id),ago=dayKey(new Date(Date.now()-8*86400000));for(let i=0;i<6;i++)room.home.family.kittens.push({...room.home.family.parents[0],id:'full-'+i,name:'猫'+i,generation:1,bornOn:ago,growth:800,lastGrowthDay:dayKey()});
 await f.call({method:'catPlan',kind:'graduate',catId:'full-0'},'owner');assert.equal(f.room(id).home.family.kittens.length,6);await f.call({method:'catPlan',kind:'graduate',catId:'full-0'},'partner');assert.equal(f.room(id).home.family.kittens.length,5);assert.equal(f.room(id).home.family.legacy[0].id,'full-0');assert.equal(f.room(id).home.family.legacyTotal,1);assert.equal((await f.call({method:'visitRoom',roomId:id},'guest')).home.family.legacy.length,0);
});
test('first eligible visitor gets the chosen sex; solo second needs growth and care; private rooms cannot merge',async()=>{
 const f=fixture(),id=await f.pair(),room=f.room(id),ago=dayKey(new Date(Date.now()-8*86400000));
 room.home.family.kittens.push({...room.home.family.parents[0],id:'boy-baby',name:'小帅',sex:'boy',generation:1,bornOn:ago,growth:800,lastGrowthDay:dayKey()});
 for(const uid of ['guest','second'])for(let i=0;i<3;i++)await f.action(uid,'family_help',{},undefined,id);
 for(const uid of ['guest','second'])await f.call({method:'createRoom'},uid);
 const results=await Promise.allSettled(['guest','second'].map(uid=>f.call({method:'adoptCat',sourceRoomId:id,sex:'boy'},uid)));
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(f.room(id).home.family.legacyTotal,1);
 const winner=results.find(r=>r.status==='fulfilled').value,uid=f.room(winner.roomId).members.me;
 f.room(id).home.family.kittens.push({...f.room(id).home.family.parents[1],id:'girl-baby',sex:'girl',generation:1,bornOn:ago,growth:800,lastGrowthDay:dayKey()});
 f.advance(86400000);for(let i=0;i<3;i++)await f.action(uid,'family_help',{},undefined,id);
 await assert.rejects(f.call({method:'adoptCat',sourceRoomId:id,sex:'girl'},uid),e=>e.code==='NOT_READY');
 const another=await f.call({method:'createRoom'},'solo');assert.equal(another.home.family.parents.length,0);
 const saved=await f.call({method:'saveMemory',requestId:'req-private-merge',payload:{kind:'note',title:'私人信件'}},'solo');
 const code=(await f.call({method:'invite'},uid)).code;await assert.rejects(f.approvedJoin(code,'solo'),e=>e.code==='MERGE_UNAVAILABLE');
 await f.call({method:'editMemory',requestId:'req-private-delete',payload:{id:saved.items[0].id,remove:true}},'solo');
 const joined=await f.approvedJoin(code,'solo');assert.equal(joined.paired,true);
});
test('daily questions stay shared for the couple, rotate offline, and generated messages appear in interactions',async()=>{
 const {fallbackContent}=require('../server/rules/daily-content');
 assert.notDeepEqual(fallbackContent('2026-10-12').questions,fallbackContent('2026-10-13').questions);
 let generations=0;const generated={day:dayKey(),source:'AI 每日更新',questions:fallbackContent(dayKey()).questions.map((q,i)=>({...q,title:'今天一起玩第 '+(i+1)+' 题？'})),messages:{hug:'今晚给你一个暖暖的拥抱。',miss:'今天又有一点想你了。',cheer:'一起加油，慢慢走就好。'}};
 const f=fixture({getApiKey:()=> 'test-key',requestDaily:async()=>{generations++;return generated;}}),id=await f.pair();
 const owner=await f.call({method:'dailyContent'},'owner'),partner=await f.call({method:'dailyContent'},'partner');
 assert.equal(generations,1);assert.deepEqual(owner.daily.questions,partner.daily.questions);assert.equal(partner.daily.source,'AI 每日更新');
 await f.action('owner','duet_submit',{answers:[0,0,0,0,0]});const waiting=await f.call({method:'getHome'},'partner');assert.equal(waiting.home.adventure.duet.answers.me,undefined);assert.deepEqual(waiting.daily.questions,owner.daily.questions);
 await f.action('partner','hug',{kind:'miss'});assert.equal(f.room(id).home.adventure.reactions[0].text,generated.messages.miss);
});
test('simultaneous daily opens generate once and the other person waits for the same questions',async()=>{
 let start;const started=new Promise(resolve=>{start=resolve;});let release;const finish=new Promise(resolve=>{release=resolve;});let generated=0;
 const f=fixture({getApiKey:()=> 'test-key',requestDaily:async()=>{generated++;start();await finish;return {...require('../server/rules/daily-content').fallbackContent(dayKey()),source:'AI 每日更新'};}});await f.pair();
 const first=f.call({method:'dailyContent'},'owner');await started;
 const other=await f.call({method:'dailyContent'},'partner');assert.equal(other.waiting,true);release();
 const ready=await first,peer=await f.call({method:'dailyContent'},'partner');assert.equal(generated,1);assert.deepEqual(ready.daily.questions,peer.daily.questions);
});
test('OPENID controls role and room access; roomId and role from clients cannot grant access',async()=>{
 const f=fixture();await assert.rejects(f.call({method:'createRoom'},''),e=>e.code==='UNAUTHENTICATED');const owner=await f.call({method:'createRoom'},'owner');assert.equal(owner.role,'me');assert.deepEqual(owner.home.family.parents.map(c=>c.name),['公猫','母猫']);
 await assert.rejects(f.call({method:'getHome',roomId:owner.roomId},'stranger'),e=>e.code==='NO_ROOM');const checkin=await f.call({method:'action',action:'checkin',role:'you',roomId:owner.roomId,requestId:'req-role-spoof'},'owner');assert.equal(checkin.home.checkins.me,dayKey());assert.equal(checkin.home.checkins.you,undefined);
 const other=await f.call({method:'createRoom'},'stranger');assert.notEqual(other.roomId,owner.roomId);assert.equal(other.home.coins,120);assert.equal(other.items.length,0);
 assert.equal(other.home.family.parents.length,0);assert.equal(other.home.family.kittens.length,0);await f.action('stranger','game',{moves:12});assert.equal((await f.call({method:'getHome'},'stranger')).home.coins,140);
});
test('one-time invitations bind exactly one partner, expire and rate limit invalid guesses',async()=>{
 const f=fixture();await f.call({method:'createRoom'},'owner');const invite=await f.call({method:'invite'},'owner');assert.match(invite.code,/^[A-HJ-NP-Z2-9]{10}$/);
 const result=await Promise.allSettled(['a','b'].map(uid=>f.approvedJoin(invite.code,uid)));assert.equal(result.filter(r=>r.status==='fulfilled').length,1);const joined=result.find(r=>r.status==='fulfilled').value;assert.equal(joined.role,'you');assert.equal(joined.paired,true);
 await assert.rejects(f.call({method:'joinRoom',code:invite.code},'third'),e=>e.code==='BAD_INVITE');await assert.rejects(f.call({method:'invite'},'owner'),e=>e.code==='ROOM_FULL');
 const g=fixture();await g.call({method:'createRoom'},'owner');const old=await g.call({method:'invite'},'owner');g.advance(86400001);await assert.rejects(g.call({method:'joinRoom',code:old.code},'guest'),e=>e.code==='BAD_INVITE');
 for(let i=0;i<8;i++)await assert.rejects(g.call({method:'joinRoom',code:'AAAAAAAAAA'},'guesser'),e=>e.code==='BAD_INVITE');await assert.rejects(g.call({method:'joinRoom',code:'AAAAAAAAAA'},'guesser'),e=>e.code==='RATE_LIMIT');
});
test('a new housemate must inspect and personally accept the current resident cats before joining',async()=>{
 const f=fixture(),roomId=await f.pair();await f.call({method:'kickPartner'},'owner');
 const code=(await f.call({method:'invite'},'owner')).code,preview=await f.call({method:'joinPreview',code},'newMate');
 assert.equal(preview.residentCats.length,2);assert.deepEqual(preview.residentCats.map(cat=>cat.name),['公猫','母猫']);
 await assert.rejects(f.call({method:'joinRoom',code},'newMate'),error=>error.code==='CONSENT_REQUIRED');
 await assert.rejects(f.call({method:'joinRoom',code,consentToken:preview.consentToken},'newMate'),error=>error.code==='CONSENT_REQUIRED');
 await assert.rejects(f.call({method:'joinRoom',code,acceptResidentCats:true,consentToken:'wrong'},'newMate'),error=>error.code==='CONSENT_REQUIRED');
 assert.equal(f.room(roomId).members.you,null);
 f.room(roomId).home.family.kittens.push({...f.room(roomId).home.family.parents[0],id:'new-before-join',generation:1});
 await assert.rejects(f.call({method:'joinRoom',code,acceptResidentCats:true,consentToken:preview.consentToken},'newMate'),error=>error.code==='CONSENT_REQUIRED');
 const updated=await f.call({method:'joinPreview',code},'newMate');assert.equal(updated.residentCats.length,3);
 const joined=await f.call({method:'joinRoom',code,acceptResidentCats:true,consentToken:updated.consentToken},'newMate');assert.equal(joined.role,'you');
});
test('concurrent care and duplicate request IDs preserve personal fish and independent pet state',async()=>{
 const f=fixture(),id=await f.pair();const duplicate=await Promise.all([f.action('owner','feed',{catId:'cat-boy'},'req-duplicate-1'),f.action('owner','feed',{catId:'cat-boy'},'req-duplicate-1')]);assert.equal(duplicate.length,2);assert.equal((await f.call({method:'getHome'},'owner')).home.coins,115);assert.equal(f.room(id).home.family.parents[0].growth,804);
 await Promise.all([f.action('owner','pet',{catId:'cat-boy'}),f.action('partner','feed',{catId:'cat-girl'})]);const h=f.room(id).home;assert.equal((await f.call({method:'getHome'},'owner')).home.coins,115);assert.equal((await f.call({method:'getHome'},'partner')).home.coins,10);assert.equal(h.family.parents[0].growth,806);assert.equal(h.family.parents[1].growth,804);assert.equal(h.family.parents[0].hunger,90);assert.equal(h.family.parents[1].hunger,90);
});
test('duet answers remain private until both members submit; result is awarded once',async()=>{
 const f=fixture(),id=await f.pair(),answers=[0,1,2,3,0];await f.action('owner','duet_submit',{answers});const partner=await f.call({method:'getHome'},'partner');assert.equal(partner.home.adventure.duet.answers.me,undefined);assert.equal(partner.home.adventure.duet.submitted.me,true);assert.equal(partner.home.adventure.duet.answers.you,undefined);
 const before=(await f.call({method:'getHome'},'owner')).home.coins+(await f.call({method:'getHome'},'partner')).home.coins;const complete=await f.action('partner','duet_submit',{answers});assert.deepEqual(complete.home.adventure.duet.answers.me,answers);assert.equal((await f.call({method:'getHome'},'owner')).home.coins+(await f.call({method:'getHome'},'partner')).home.coins,before+50);await assert.rejects(f.action('owner','duet_submit',{answers}));assert.equal((await f.call({method:'getHome'},'owner')).home.coins+(await f.call({method:'getHome'},'partner')).home.coins,before+50);
});
test('two simultaneous co-op claims grant a single reward',async()=>{
 const f=fixture(),id=await f.pair();for(const uid of ['owner','partner']){await f.action(uid,'pet');await f.action(uid,'catch',{score:5});await f.action(uid,'hug');}const before=(await f.call({method:'getHome'},'owner')).home.coins+(await f.call({method:'getHome'},'partner')).home.coins;const result=await Promise.allSettled(['owner','partner'].map(uid=>f.action(uid,'quest_claim')));assert.equal(result.filter(x=>x.status==='fulfilled').length,1);assert.equal((await f.call({method:'getHome'},'owner')).home.coins+(await f.call({method:'getHome'},'partner')).home.coins,before+60);
});
test('adult parents, shared care and timer unlock one litter even with concurrent birth requests',async()=>{
 const f=fixture(),id=await f.pair();await assert.rejects(f.action('owner','start_litter'));const home=f.room(id).home;const ago=dayKey(new Date(Date.now()-8*86400000));for(const cat of home.family.parents){cat.bornOn=ago;cat.growth=800;cat.lastGrowthDay=dayKey();}home.family.bond=30;home.family.nestBuilt=true;await f.action('owner','start_litter');assert.ok(f.room(id).home.family.pending);
 await assert.rejects(f.action('owner','welcome_kittens'));await Promise.all(['owner','partner'].map(uid=>f.action(uid,'care_nest')));await Promise.all(['owner','partner'].map(uid=>f.action(uid,'care_nest')));f.room(id).home.family.pending.dueAt=new Date(Date.now()-1000).toISOString();const expected=f.room(id).home.family.pending.expected;const births=await Promise.allSettled(['owner','partner'].map(uid=>f.action(uid,'welcome_kittens')));assert.equal(births.filter(x=>x.status==='fulfilled').length,1);assert.equal(f.room(id).home.family.kittens.length,expected);assert.equal(f.room(id).home.family.pending,null);
 const baby=f.room(id).home.family.kittens[0];await f.action('partner','cat_rename',{catId:baby.id,name:'小云朵'});await f.action('owner','feed',{catId:baby.id});assert.equal(f.room(id).home.family.kittens[0].name,'小云朵');assert.equal(f.room(id).home.family.kittens[0].growth,4);
});
test('photo bytes are validated, both members can edit, foreign rooms cannot read or attach file IDs',async()=>{
 const f=fixture(),id=await f.pair();await assert.rejects(f.call({method:'saveMemory',requestId:'req-no-photo',payload:{kind:'photo',title:'偷来的图',media:'cloud://other/file'}},'owner'));
 const created=await f.call({method:'saveMemory',requestId:'req-photo-one',payload:{kind:'photo',title:'我们的照片',imageBase64:png}},'owner');assert.equal(created.items.length,1);const memory=created.items[0];assert.ok(memory.mediaURL);const peer=await f.call({method:'getHome'},'partner');assert.equal(peer.items[0].media,memory.media);
 const other=await f.call({method:'createRoom'},'stranger');assert.equal((await f.call({method:'getHome',roomId:id},'stranger')).items.length,0);assert.notEqual(other.roomId,id);
 const edited=await f.call({method:'saveMemory',requestId:'req-photo-edit',payload:{id:memory.id,kind:'photo',title:'我们的小日子',body:'再补上一句话'}},'partner');assert.equal(edited.items[0].title,'我们的小日子');await f.call({method:'editMemory',requestId:'req-photo-delete',payload:{id:memory.id,remove:true}},'partner');assert.equal(f.room(id).items.length,0);assert.ok(f.deleted.includes(memory.media));
});
test('a response failure after saving a photo does not delete the committed image, retries stay idempotent',async()=>{
 const f=fixture(),id=await f.pair(),event={method:'saveMemory',requestId:'req-url-failure',payload:{kind:'photo',title:'网络里留住的照片',imageBase64:png}};f.failURL();const saved=await f.call(event,'owner');assert.equal(saved.items[0].mediaURL,'');const file=f.room(id).items[0].media;assert.ok(f.files.has(file));assert.equal(f.deleted.includes(file),false);await f.call(event,'owner');assert.equal(f.room(id).items.length,1);assert.ok(f.files.has(file));assert.equal(f.files.size,1);
});
test('backup import preserves cats, kittens, pending litter and photos captions; only an empty owner room can import',async()=>{
 const f=fixture(),s=await f.call({method:'createRoom'},'owner'),home=clone(s.home);home.coins=432;home.family.parents[0].growth=97;home.family.parents[0].outfit='scarf';home.family.kittens=[{...home.family.parents[1],id:'baby-import',name:'小宝宝',growth:30,generation:1}];home.family.pending={id:'litter-import',dueAt:new Date(Date.now()+500000).toISOString(),warmth:2,expected:1,care:{}};
 const backup=JSON.stringify({home,items:[{kind:'photo',title:'旧照片',body:'旧文字',media:'old-web-file',author:'you',created_at:new Date().toISOString()}]});const imported=await f.call({method:'importBackup',backup,requestId:'req-import-one'},'owner');assert.equal(imported.home.coins,432);assert.equal(imported.home.family.parents[0].growth,97);assert.equal(imported.home.family.parents[0].outfit,'scarf');assert.equal(imported.home.family.kittens[0].name,'小宝宝');assert.equal(imported.home.family.pending.id,'litter-import');assert.equal(imported.items[0].media,null);assert.equal(imported.items[0].needsPhoto,true);await assert.rejects(f.call({method:'importBackup',backup,requestId:'req-import-two'},'owner'),e=>e.code==='NOT_EMPTY');
 const g=fixture();await g.pair();await assert.rejects(g.call({method:'importBackup',backup,requestId:'req-peer-import'},'partner'),e=>e.code==='FORBIDDEN');
});
test('AI status is truthful and unconnected; server rejects chat rather than producing canned replies',async()=>{
 const f=fixture();await f.call({method:'createRoom'},'owner');assert.equal((await f.call({method:'chatStatus'},'owner')).ready,false);await assert.rejects(f.call({method:'chatSend',message:'喵'},'owner'),e=>e.code==='AI_UNAVAILABLE');
});
test('Hunyuan provider uses the free-only cloud path even if an OpenAI key exists',async()=>{
 const inputs=[],ai={createModel:()=>({generateText:async()=>({text:'喵，今天一起玩吧！'})})};
 const f=fixture({getProvider:()=> 'hunyuan',getApiKey:()=> 'unused-key',getCloudAI:()=>ai,requestCloudAI:async value=>{inputs.push(value);return '喵，今天一起玩吧！';},requestAI:async()=>{throw Error('OpenAI should not be called');}});
 await f.call({method:'createRoom'},'owner');
 const status=await f.call({method:'chatStatus'},'owner');assert.equal(status.ready,true);assert.equal(status.model,'hy3');
 const response=await f.call({method:'chatSend',catId:'cat-girl',message:'你好'},'owner');
 assert.equal(response.reply,'喵，今天一起玩吧！');assert.equal(inputs.length,1);assert.equal(inputs[0].ai,ai);assert.equal(inputs[0].apiKey,undefined);
});
test('hungry cats pause chat until fed; successful replies lower only that cat hunger',async()=>{
 const f=fixture({getApiKey:()=> 'test-key',requestAI:async()=> '喵！'}),id=await f.pair();
 const event={method:'chatSend',catId:'cat-girl',message:'陪我聊聊'};
 for(let i=0;i<10;i++){if(i&&i%4===0)f.advance(60000);await f.call(event,'owner');}
 assert.equal(f.room(id).home.family.parents[1].hunger,38);assert.equal(f.room(id).home.family.parents[0].hunger,68);
 await assert.rejects(f.call(event,'owner'),e=>e.code==='CAT_HUNGRY');
 await f.action('owner','feed',{catId:'cat-girl'});assert.equal((await f.call(event,'owner')).reply,'喵！');
});
test('ad rewards stay inactive until configured, require a ticket, and are capped in the room',async()=>{
 const f=fixture(),id=await f.pair();await assert.rejects(f.call({method:'adTicket'},'owner'),e=>e.code==='AD_UNAVAILABLE');
 const old=process.env.MW_REWARDED_AD_UNIT_ID;process.env.MW_REWARDED_AD_UNIT_ID='adunit-test';
 try{
  for(let i=0;i<3;i++){
   const {ticket}=await f.call({method:'adTicket',visitRoom:id},'visitor');
   await assert.rejects(f.call({method:'claimAdReward',visitRoom:id,ticket},'visitor'),e=>e.code==='AD_INVALID');
   f.advance(6000);const reward=await f.call({method:'claimAdReward',visitRoom:id,ticket},'visitor');assert.equal(reward.home.coins,15+(i+1)*20);
   await assert.rejects(f.call({method:'claimAdReward',visitRoom:id,ticket},'visitor'),e=>e.code==='AD_INVALID');
  }
  await assert.rejects(f.call({method:'adTicket',visitRoom:id},'visitor'),e=>e.code==='AD_LIMIT');
  const another=(await f.call({method:'createRoom'},'another-host')).roomId;
  await assert.rejects(f.call({method:'adTicket',visitRoom:another},'visitor'),e=>e.code==='AD_LIMIT');
  assert.equal((await f.call({method:'visitRoom',roomId:another},'visitor')).home.coins,75);
  assert.equal(f.room(id).home.coins,120);
 }finally{if(old===undefined)delete process.env.MW_REWARDED_AD_UNIT_ID;else process.env.MW_REWARDED_AD_UNIT_ID=old;}
});
test('AI chat uses selected cat and supplied text, with a per-minute throttle but no daily cap',async()=>{
 const requests=[],f=fixture({getApiKey:()=> 'test-key',requestAI:async input=>{requests.push(input);return '喵，今天一起玩吧！';}}),id=await f.pair();
 await f.call({method:'saveMemory',requestId:'req-chat-photo',payload:{kind:'photo',title:'不能交给聊天的照片',imageBase64:png}},'owner');
 const guest=await f.call({method:'visitRoom',roomId:id},'visitor');assert.equal(guest.role,'guest');
 const ownerStatus=await f.call({method:'chatStatus'},'owner'),guestStatus=await f.call({method:'chatStatus',visitRoom:id},'visitor');assert.equal(ownerStatus.ready,true);assert.equal(guestStatus.ready,true);assert.notEqual(ownerStatus.viewerKey,guestStatus.viewerKey);
 const event={method:'chatSend',visitRoom:id,catId:'cat-girl',personality:'sassy',message:'今天开心吗',history:[{role:'user',text:'你好'},{role:'assistant',text:'喵'}]};
 assert.equal((await f.call(event,'visitor')).reply,'喵，今天一起玩吧！');assert.equal(requests[0].name,'母猫');assert.equal(requests[0].sex,'girl');assert.equal(requests[0].personality,'sassy');assert.equal(requests[0].apiKey,'test-key');assert.deepEqual(requests[0].history,event.history);assert.equal(JSON.stringify(requests).includes('不能交给聊天的照片'),false);
 for(let i=1;i<4;i++)await f.call({...event,message:'喵'+i},'visitor');
 await assert.rejects(f.call(event,'visitor'),e=>e.code==='AI_LIMIT');f.advance(60000);
 for(let i=4;i<12;i++){if(i===8)f.advance(60000);if(f.room(id).home.family.parents[1].hunger<40)await f.action('visitor','feed',{catId:'cat-girl'},undefined,id);await f.call(event,'visitor');}
 assert.equal(requests.length,12);
 for(let i=0;i<32;i++){if(i&&i%4===0)f.advance(60000);if(f.room(id).home.family.parents[0].hunger<40)await f.action('owner','feed',{catId:'cat-boy'});await f.call({...event,visitRoom:'',catId:'cat-boy',history:[]},'owner');}
 assert.equal(requests.length,44);
 if(f.room(id).home.family.parents[0].hunger<40)await f.action('partner','feed',{catId:'cat-boy'});
 assert.equal((await f.call({...event,visitRoom:'',catId:'cat-boy',history:[]},'partner')).reply,'喵，今天一起玩吧！');assert.equal(requests.at(-1).name,'公猫');
 await assert.rejects(f.call({...event,catId:'nonexistent'},'owner'),e=>e.code==='BAD_INPUT');
 await assert.rejects(f.call({...event,message:'字'.repeat(601)},'owner'),e=>e.code==='BAD_INPUT');
 await assert.rejects(f.call({...event,history:Array(9).fill({role:'user',text:'长'})},'owner'),e=>e.code==='BAD_INPUT');
 assert.equal(f.room(id).items[0].title,'不能交给聊天的照片');
 await assert.rejects(f.call({...event,visitRoom:''},'visitor'),e=>e.code==='NO_ROOM');
});
test('shared room link lets visitors play without a code, but keeps personal media private',async()=>{
 const f=fixture(),id=await f.pair();await f.call({method:'saveMemory',requestId:'req-private-photo',payload:{kind:'photo',title:'私密照片',imageBase64:png}},'owner');
 const before=f.urlCalls(),guest=await f.call({method:'visitRoom',roomId:id},'visitor');
 assert.equal(guest.role,'guest');assert.deepEqual(guest.items,[]);assert.equal(f.urlCalls(),before);assert.equal(guest.home.me,'小屋主人');assert.equal(guest.home.together,'');assert.equal(guest.home.adventure.reactions.length,0);
 const read=await f.call({method:'getHome',visitRoom:id},'visitor');assert.deepEqual(read.items,[]);assert.equal(f.urlCalls(),before);
 for(const action of ['feed','pet','catch','game'])await f.action('visitor',action,action==='catch'?{score:4}:action==='game'?{moves:10}:{catId:'cat-girl'},undefined,id);
 assert.equal((await f.call({method:'chatStatus',visitRoom:id},'visitor')).ready,false);await assert.rejects(f.call({method:'chatSend',visitRoom:id,message:'你好'},'visitor'),e=>e.code==='AI_UNAVAILABLE');
 for(const action of ['settings','cat_rename','checkin','shop','build_nest','start_litter','hug','duet_submit','quest_claim'])await assert.rejects(f.action('visitor',action,{catId:'cat-boy',name:'越权',answers:[0,0,0,0,0]},undefined,id),e=>e.code==='FORBIDDEN');
 for(const method of ['saveMemory','editMemory','importBackup']){
  const event={method,visitRoom:id,requestId:'req-guest-'+method,backup:JSON.stringify({home:initialHome,items:[]}),payload:{kind:'note',title:'越权',id:'private'}};
  await assert.rejects(f.call(event,'visitor'),e=>e.code==='FORBIDDEN');
 }
 assert.equal(f.room(id).items.length,1);assert.equal(f.room(id).members.you,'partner');assert.equal(!!f.room(id).home.adventure.quest.care.me,false);
 const own=await f.call({method:'createRoom'},'visitor');assert.notEqual(own.roomId,id);assert.equal((await f.call({method:'getHome'},'visitor')).roomId,own.roomId);
 assert.equal((await f.call({method:'visitRoom',roomId:id},'visitor')).role,'guest');
 assert.equal((await f.call({method:'getHome',visitRoom:id},'visitor')).items.length,0);
 await assert.rejects(f.call({method:'invite',kind:'guest'},'owner'),e=>e.code==='BAD_INPUT');
});
test('visitor link remains usable until the owner closes the room',async()=>{
 const f=fixture(),id=await f.pair();f.advance(86400001);assert.equal((await f.call({method:'visitRoom',roomId:id},'late')).role,'guest');
 await f.call({method:'deleteRoom'},'owner');await assert.rejects(f.call({method:'visitRoom',roomId:id},'late'),e=>e.code==='NO_ROOM');
});
test('both owners can rename anyone or any cat, then each name cools down for three days',async()=>{
 const f=fixture();await f.pair();assert.equal((await f.call({method:'getHome'},'owner')).home.roomName,'温馨猫屋');await f.action('owner','settings',{roomName:'我们和猫的星球',me:'鑫',you:'涛',catName:'小鑫',girlName:'小涛'});
 assert.equal(f.room((await f.call({method:'session'},'owner')).roomId).home.you,'涛');
 assert.equal((await f.call({method:'getHome'},'partner')).home.roomName,'我们和猫的星球');
 await assert.rejects(f.action('partner','settings',{roomName:'新名字'}),e=>e.code==='RENAME_LIMIT');
 await assert.rejects(f.action('partner','settings',{me:'新鑫'}),e=>e.code==='RENAME_LIMIT');
 await assert.rejects(f.action('partner','cat_rename',{catId:'cat-girl',name:'桃子'}),e=>e.code==='RENAME_LIMIT');
 const dateOnly=await f.action('partner','settings',{together:'2024-02-14'});assert.equal(dateOnly.home.together,'2024-02-14');
 f.advance(3*86400000);await f.action('partner','settings',{me:'新鑫',roomName:'我们的小窝'});await f.action('partner','cat_rename',{catId:'cat-girl',name:'桃子'});
 assert.equal((await f.call({method:'getHome'},'owner')).home.roomName,'我们的小窝');
 assert.equal((await f.call({method:'getHome'},'owner')).home.family.parents[1].name,'桃子');
});

async function ordinaryPair(f){if(!f.data.has(collections.users+':owner'))await f.pair();const id=(await f.call({method:'createRoom'},'ordinary')).roomId;const room=f.room(id);room.members={me:'owner',you:'partner'};room.home=clone(f.room(f.data.get(collections.invites+':mw-founder-pair-v1').roomId).home);room.home.family.founderNursery=false;room.home.family.kittens=[];room.home.family.birthCount=0;room.home.family.lastBirthAt=null;room.home.family.feedingProgress=0;room.home.coins=120;for(const cat of room.home.family.parents){cat.growth=800;cat.bornOn=dayKey(new Date(Date.now()-8*86400000));}for(const uid of ['owner','partner'])f.data.set(collections.users+':'+uid,{roomId:id,fishBalance:200,starterGranted:true});return id;}
test('renamed full and sleeping cats return explicit care errors without spending fish',async()=>{const f=fixture(),id=await f.pair(),cat=f.room(id).home.family.parents[0];cat.name='帅哥';cat.hunger=100;const coins=f.room(id).home.coins;await assert.rejects(f.action('owner','feed'),e=>e.code==='BAD_ACTION'&&e.message.includes('已经吃饱'));assert.equal(f.room(id).home.coins,coins);cat.sleeping=true;await assert.rejects(f.action('owner','pet'),e=>e.code==='BAD_ACTION'&&e.message.includes('做美梦'));});
test('founder replenishes beyond four daily litters after adoptions without milk; room flag cannot be imported into normal rooms',async()=>{const f=fixture(),id=await f.pair();f.data.get(collections.users+':owner').fishBalance=500;for(let cycle=0;cycle<7;cycle++){for(let i=0;i<12;i++)await f.action('owner','family_help');const room=f.room(id);assert.equal(room.home.family.birthCount,cycle+1);assert.ok(room.home.family.kittens.length>=1&&room.home.family.kittens.length<=2);const uid='adopter-'+cycle;for(let i=0;i<3;i++)await f.action(uid,'family_help',{},undefined,id);await adoptCreatedHome(f,{method:'adoptCat',sourceRoomId:id,sex:f.room(id).home.family.kittens[0].sex},uid);f.room(id).home.family.kittens=[];f.room(id).home.family.feedingProgress=0;}assert.equal(f.room(id).home.family.nurseryMilk,0);const room=f.room(id);room.home.family.kittens=Array.from({length:48},(_,i)=>({...room.home.family.parents[0],id:'full-'+i,generation:1}));for(let i=0;i<12;i++)await f.action('owner','family_help');assert.equal(f.room(id).home.family.kittens.length,48);assert.equal(f.room(id).home.family.birthCount,7);for(let i=0;i<3;i++)await f.action('full-adopter','family_help',{},undefined,id);await adoptCreatedHome(f,{method:'adoptCat',sourceRoomId:id,sex:'boy'},'full-adopter');await f.action('full-adopter','family_help',{},undefined,id);assert.equal(f.room(id).home.family.birthCount,8);assert.equal(f.room(id).home.family.kittens.length,48);const normal=await ordinaryPair(f);f.room(normal).home.family.founderNursery=true;const snapshot=await f.call({method:'getHome'},'owner');assert.equal(snapshot.home.family.founderNursery,false);await f.action('owner','family_help');assert.equal(f.room(normal).home.family.founderNursery,false);});
test('founder visitors can put a cat to sleep and wake it, but ordinary-room visitors cannot',async()=>{
 const f=fixture(),founder=await f.pair(),visitor='sleep-visitor';
 const start=await f.call({method:'visitRoom',roomId:founder},visitor);
 assert.equal(start.home.family.founderNursery,true);
 const sleeping=await f.action(visitor,'sleep',{catId:'cat-boy'},undefined,founder);
 assert.equal(sleeping.home.family.parents[0].sleeping,true);
 assert.equal(sleeping.home.coins,start.home.coins-3);
 const waking=await f.action(visitor,'sleep',{catId:'cat-boy'},undefined,founder);
 assert.equal(waking.home.family.parents[0].sleeping,false);
 assert.equal(waking.home.coins,sleeping.home.coins);
 const ordinary=await ordinaryPair(f);
 await assert.rejects(f.action('ordinary-visitor','sleep',{catId:'cat-boy'},undefined,ordinary),e=>e.code==='FORBIDDEN');
});
test('temporary photo URL failure does not misreport a saved feeding action',async()=>{const f=fixture(),id=await f.pair();await f.call({method:'saveMemory',requestId:'req-feed-photo',payload:{kind:'photo',title:'照片',imageBase64:png}},'owner');f.advance(120001);f.failURL();const result=await f.action('owner','feed',{},'req-fed-once');assert.equal(result.home.coins,115);assert.equal(result.items[0].mediaURL,'');const retry=await f.action('owner','feed',{},'req-fed-once');assert.equal(retry.home.coins,115);assert.ok(retry.items[0].mediaURL);});

async function adoptCreatedHome(f,event,uid){await f.call({method:'createRoom'},uid);return f.call(event,uid);}
test('visitors must create their own room before adoption; failed claim preserves care and kitten',async()=>{const f=fixture(),id=await f.pair();for(let i=0;i<12;i++)await f.action('owner','family_help');for(let i=0;i<3;i++)await f.action('new-visitor','family_help',{},undefined,id);const count=f.room(id).home.family.kittens.length,sex=f.room(id).home.family.kittens[0].sex;await assert.rejects(f.call({method:'adoptCat',sourceRoomId:id,sex},'new-visitor'),e=>e.code==='BAD_INPUT'&&e.message.includes('先创建'));assert.equal(f.room(id).home.family.kittens.length,count);assert.equal((await f.call({method:'visitRoom',roomId:id},'new-visitor')).adoption.credits,3);const own=await f.call({method:'createRoom'},'new-visitor');assert.equal(own.home.family.parents.length,0);await f.call({method:'adoptCat',sourceRoomId:id,sex},'new-visitor');assert.equal((await f.call({method:'getHome'},'new-visitor')).home.family.parents.length,1);});
test('both owners can gift a named kitten directly; first recipient wins and credits are not required',async()=>{
 const f=fixture(),id=await f.pair(),room=f.room(id);
 room.home.family.kittens.push({...room.home.family.parents[0],id:'gift-baby',name:'小奶糖',generation:1,growth:0});
 for(const sender of ['owner','partner']){
  const card=await f.call({method:'giftCreate',catId:'gift-baby'},sender);
  const entry=await f.call({method:'giftEntry',token:card.token},'reader');assert.equal(entry.name,'小奶糖');assert.equal(entry.hasOwnHome,false);
  await assert.rejects(f.call({method:'giftClaim',token:card.token},'reader'),e=>e.code==='BAD_INPUT'&&e.message.includes('创建自己的小屋'));
  if(sender==='partner'){
   const a=await f.call({method:'createRoom'},'reader'),b=await f.call({method:'createRoom'},'other-reader');assert.equal(a.home.family.parents.length,0);assert.equal(b.home.family.parents.length,0);
   const race=await Promise.allSettled([f.call({method:'giftClaim',token:card.token},'reader'),f.call({method:'giftClaim',token:card.token},'other-reader')]);assert.equal(race.filter(x=>x.status==='fulfilled').length,1);
   const winner=race.find(x=>x.status==='fulfilled').value;assert.equal(winner.home.family.parents[0].id,'gift-baby');assert.equal(f.room(id).home.family.kittens.length,0);
   const winnerUid=f.room(winner.roomId).members.me;assert.equal((await f.call({method:'giftClaim',token:card.token},winnerUid)).roomId,winner.roomId);assert.equal((await f.call({method:'giftEntry',token:card.token},winnerUid)).claimed,true);
   await assert.rejects(f.call({method:'giftClaim',token:card.token},winnerUid==='reader'?'other-reader':'reader'),e=>e.code==='NOT_FOUND');
   assert.equal((await f.call({method:'visitRoom',roomId:id},winnerUid)).adoption.credits,0);
  }
 }
 await assert.rejects(f.call({method:'giftCreate',catId:'cat-boy'},'owner'),e=>e.code==='NOT_FOUND');
 await assert.rejects(f.call({method:'giftCreate',catId:'gift-baby'},'outsider'),e=>e.code==='NO_ROOM'||e.code==='FORBIDDEN');
});
test('solo owner raises one cat to adulthood and earns 30 care actions before accepting a same-sex gift',async()=>{
 const f=fixture(),founder=await f.pair(),first=f.room(founder).home.family.parents[0];
 f.room(founder).home.family.kittens.push({...first,id:'solo-first',sex:'boy',generation:1,growth:0,bornOn:dayKey()});
 for(let i=0;i<3;i++)await f.action('solo-owner','family_help',{},undefined,founder);
 await f.call({method:'createRoom'},'solo-owner');await f.call({method:'adoptCat',sourceRoomId:founder,sex:'boy'},'solo-owner');
 const homeId=f.data.get(collections.users+':solo-owner').roomId;
 f.room(founder).home.family.kittens.push({...f.room(founder).home.family.parents[1],id:'solo-second',sex:'girl',generation:1,growth:0});
 const card=await f.call({method:'giftCreate',catId:'solo-second'},'partner');
 await assert.rejects(f.call({method:'giftClaim',token:card.token},'solo-owner'),e=>e.code==='NOT_READY');
 for(let i=0;i<30;i++)await f.action('solo-owner','pet',{catId:'solo-first'});
 assert.equal(f.room(homeId).home.visits.me,30);await assert.rejects(f.call({method:'giftClaim',token:card.token},'solo-owner'),e=>e.code==='NOT_READY');
 f.room(homeId).home.family.parents[0].growth=800;
 const same=f.room(founder).home.family.parents[0];f.room(founder).home.family.kittens.push({...same,id:'wrong-sex',sex:'boy',generation:1,growth:0});const wrong=await f.call({method:'giftCreate',catId:'wrong-sex'},'owner');
 const adopted=await f.call({method:'giftClaim',token:wrong.token},'solo-owner');assert.equal(adopted.home.family.parents.length,2);assert.equal(adopted.home.family.parents[1].sex,'boy');assert.equal(adopted.paired,false);
 assert.equal(f.room(homeId).catGuardians['solo-first'],'solo-owner');assert.equal(f.room(homeId).catGuardians['wrong-sex'],'solo-owner');
 await assert.rejects(f.call({method:'giftClaim',token:card.token},'solo-owner'),e=>e.code==='NEED_PARTNER');
 f.room(homeId).home.family.parents[1].growth=800;assert.equal(require('../server/rules/cat-family').familyRequirements(f.room(homeId).home,dayKey()).adult,false);await assert.rejects(f.action('solo-owner','start_litter'),/成年公猫和成年母猫/);
});
test('solo second cat can also be earned by helping in the founder room; paired rooms retain one cat per guardian',async()=>{
 const f=fixture(),source=await f.pair(),first=f.room(source).home.family.parents[0];f.room(source).home.family.kittens.push({...first,id:'first',generation:1,growth:800,sex:'boy'});
 for(let i=0;i<3;i++)await f.action('solo','family_help',{},undefined,source);await f.call({method:'createRoom'},'solo');await f.call({method:'adoptCat',sourceRoomId:source,sex:'boy'},'solo');
 const solo=f.room(f.data.get(collections.users+':solo').roomId);solo.home.family.parents[0].growth=800;solo.home.visits.me=30;
 const girl=f.room(source).home.family.parents[1];f.room(source).home.family.kittens.push({...girl,id:'second',generation:1,growth:0,sex:'girl'});
 for(let i=0;i<3;i++)await f.action('solo','family_help',{},undefined,source);
 const next=await f.call({method:'adoptCat',sourceRoomId:source,sex:'girl'},'solo');assert.equal(next.home.family.parents.length,2);assert.equal(next.paired,false);
});
test('a partner can join an established solo two-cat room with an empty home but cannot bring a third resident',async()=>{
 const f=fixture(),source=await f.pair();
 for(const [uid,id,sex] of [['solo-keeper','first-solo','boy']]){
  const parent=f.room(source).home.family.parents.find(c=>c.sex===sex);f.room(source).home.family.kittens.push({...parent,id,sex,generation:1,growth:800});for(let i=0;i<3;i++)await f.action(uid,'family_help',{},undefined,source);await f.call({method:'createRoom'},uid);await f.call({method:'adoptCat',sourceRoomId:source,sex},uid);
 }
 const id=f.data.get(collections.users+':solo-keeper').roomId;f.room(id).home.visits.me=30;
 const girl=f.room(source).home.family.parents[1];f.room(source).home.family.kittens.push({...girl,id:'solo-partner-cat',generation:1,sex:'girl',growth:0});const gift=await f.call({method:'giftCreate',catId:'solo-partner-cat'},'owner');await f.call({method:'giftClaim',token:gift.token},'solo-keeper');
 await f.call({method:'createRoom'},'empty-partner');const code=(await f.call({method:'invite'},'solo-keeper')).code;const joined=await f.approvedJoin(code,'empty-partner');assert.equal(joined.paired,true);assert.equal(joined.home.family.parents.length,2);
 f.room(source).home.family.kittens.push({...f.room(source).home.family.parents[0],id:'third-baby',generation:1});const extra=await f.call({method:'giftCreate',catId:'third-baby'},'owner');await assert.rejects(f.call({method:'giftClaim',token:extra.token},'empty-partner'),e=>e.code==='NEED_PARTNER');
});
test('adoption selects the exact kitten and preserves its breed; a missing chosen kitten never substitutes another of the same sex',async()=>{
 const f=fixture(),source=await f.pair(),room=f.room(source);room.home.family.kittens=[];
 for(const [id,breedId] of [['first-choice','ragdoll'],['second-choice','siamese']])room.home.family.kittens.push({...room.home.family.parents[0],id,generation:1,sex:'boy',breedId,growth:0});
 for(let i=0;i<3;i++)await f.action('breed-adopter','family_help',{},undefined,source);
 await f.call({method:'createRoom'},'breed-adopter');
 await assert.rejects(f.call({method:'adoptCat',sourceRoomId:source,sex:'boy',catId:'gone'},'breed-adopter'),e=>e.code==='NOT_FOUND');
 assert.equal((await f.call({method:'visitRoom',roomId:source},'breed-adopter')).adoption.credits,3);
 const event={method:'adoptCat',sourceRoomId:source,sex:'boy',catId:'second-choice',requestId:'breed-specific-claim'};
 const claimed=await f.call(event,'breed-adopter');assert.equal(claimed.home.family.parents[0].id,'second-choice');assert.equal(claimed.home.family.parents[0].breedId,'siamese');assert.equal(f.room(source).home.family.kittens.some(c=>c.id==='first-choice'),true);
 const retry=await f.call(event,'breed-adopter');assert.equal(retry.home.family.parents[0].breedId,'siamese');
 const after=await f.call({method:'getHome'},'breed-adopter');assert.equal(after.home.family.parents[0].breedId,'siamese');
});

test('personal game rewards share an 80-fish cap and five rewarded rounds across all rooms; duplicate receipts and a new day behave correctly',async()=>{
 const f=fixture(),source=await f.pair();await f.call({method:'createRoom'},'gamer');let s;
 for(let i=0;i<3;i++)s=await f.action('gamer','catch',{score:30});assert.equal(s.gameRewards.fish,80);const fish=s.home.coins;
 s=await f.action('gamer','game',{moves:6},'shared-game-receipt',source);assert.equal(s.gameRewards.fish,80);assert.equal(s.home.coins,fish);assert.equal(s.gameRewards.gameRemaining,4);
 s=await f.action('gamer','game',{moves:6},'shared-game-receipt',source);assert.equal(s.gameRewards.gameRemaining,4);assert.equal(s.home.coins,fish);
 for(let i=0;i<6;i++)s=await f.action('gamer','catch',{score:0});assert.equal(s.gameRewards.catchRemaining,0);assert.equal(s.home.coins,fish);
 f.advance(86400000);s=await f.action('gamer','catch',{score:30});assert.equal(s.gameRewards.fish,30);assert.equal(s.gameRewards.catchRemaining,4);assert.equal(s.home.coins,fish+30);
});
test('personal game round allowance cannot be refreshed by visiting another room',async()=>{
 const f=fixture(),source=await f.pair();await f.call({method:'createRoom'},'round-player');for(let i=0;i<5;i++)await f.action('round-player','catch',{score:0});
 const before=await f.call({method:'getHome'},'round-player');assert.equal(before.gameRewards.fish,25);const after=await f.action('round-player','catch',{score:60},undefined,source);assert.equal(after.home.coins,before.home.coins);assert.equal(after.gameRewards.fish,25);assert.equal(after.gameRewards.catchRemaining,0);
 const other=await f.action('someone-else','catch',{score:0},undefined,source);assert.equal(other.gameRewards.fish,5);
});
test('founder breed nursery has every appearance, keeps stable babies and does not recreate a claimed cat after initial catalog seeding',async()=>{
 const {breeds}=require('../server/rules/cat-breeds'),f=fixture(),source=await f.pair();
 let nursery=await f.call({method:'nurseryRoom',visitRoom:source},'pool-adopter');assert.equal(nursery.role,'guest');assert.equal(nursery.home.family.kittens.length,breeds.length);assert.equal(new Set(nursery.home.family.kittens.map(c=>c.breedId)).size,breeds.length);
 const chosen=nursery.home.family.kittens[1],ids=nursery.home.family.kittens.map(c=>c.id);nursery=await f.call({method:'nurseryRoom',visitRoom:source},'pool-adopter');assert.deepEqual(nursery.home.family.kittens.map(c=>c.id),ids);
 await f.call({method:'createRoom'},'pool-adopter');const event={method:'adoptCat',sourceRoomId:source,sex:chosen.sex,catId:chosen.id,requestId:'pool-claim-stable'};
 await assert.rejects(f.call(event,'pool-adopter'),e=>e.code==='NOT_READY');for(let i=0;i<3;i++)await f.action('pool-adopter','family_help',{},undefined,source);
 const result=await f.call(event,'pool-adopter');assert.equal(result.home.family.parents[0].id,chosen.id);assert.equal(result.home.family.parents[0].breedId,chosen.breedId);assert.equal(result.home.family.founderBreedPool,undefined);
 const after=f.room(source).home.family.kittens;assert.equal(after.length,breeds.length-1);assert.equal(new Set(after.map(c=>c.breedId)).size,breeds.length-1);assert.equal(after.some(c=>c.id===chosen.id),false);assert.equal(after.some(c=>c.id===chosen.id),false);
 const retry=await f.call(event,'pool-adopter');assert.equal(retry.home.family.parents[0].id,chosen.id);assert.equal(f.room(source).home.family.kittens.length,breeds.length-1);
});
test('founder breed pool does not grant normal rooms a supply and gifting preserves the claimed identity without reseeding the catalog',async()=>{
 const f=fixture(),source=await f.pair();await f.call({method:'nurseryRoom'},'owner');const chosen=f.room(source).home.family.kittens[0];
 const own=await f.call({method:'createRoom'},'gift-recipient');const normal=await f.call({method:'nurseryRoom',founderBreedPool:true},'gift-recipient');assert.equal(normal.home.family.kittens.length,0);assert.equal(f.room(own.roomId).founderNursery,undefined);
 const gift=await f.call({method:'giftCreate',catId:chosen.id},'partner');await f.call({method:'giftClaim',token:gift.token},'gift-recipient');assert.equal(f.room(source).home.family.kittens.length,39);assert.equal(f.room(source).home.family.kittens.some(c=>c.id===chosen.id),false);
 assert.equal(f.room(own.roomId).home.family.parents[0].id,chosen.id);assert.equal(f.room(own.roomId).home.family.kittens.length,0);
});
test('competing visitors cannot claim the same founder breed baby or consume the losing visitor credits',async()=>{
 const f=fixture(),source=await f.pair();await f.call({method:'nurseryRoom'},'owner');const cat=f.room(source).home.family.kittens[0];
 for(const uid of ['race-a','race-b']){await f.call({method:'createRoom'},uid);for(let i=0;i<3;i++)await f.action(uid,'family_help',{},undefined,source);}
 const event={method:'adoptCat',sourceRoomId:source,catId:cat.id,sex:cat.sex};const result=await Promise.allSettled(['race-a','race-b'].map(uid=>f.call({...event,requestId:'claim-'+uid},uid)));assert.equal(result.filter(r=>r.status==='fulfilled').length,1);const loser=result[0].status==='rejected'?'race-a':'race-b';assert.equal((await f.call({method:'visitRoom',roomId:source},loser)).adoption.credits,3);assert.equal(f.room(source).home.family.kittens.length,39);
});
test('normal and founder nurseries stop at 48, keep completed care, and use a newly freed place for one shared-care baby',async()=>{
 const f=fixture(),id=await ordinaryPair(f),room=f.room(id);room.home.family.kittens=Array.from({length:48},(_,i)=>({...room.home.family.parents[i%2],id:'capacity-'+i,name:'宝宝'+i,generation:1,growth:0}));room.home.family.feedingProgress=11;
 let s=await f.action('visitor-at-full','family_help',{},undefined,id);assert.equal(s.home.family.kittens.length,48);assert.equal(s.home.family.feedingProgress,12);assert.match(s.message,/住满/);assert.equal(s.adoption.credits,1);
 await f.call({method:'createRoom'},'new-family');const gift=await f.call({method:'giftCreate',catId:'capacity-0'},'owner');await f.call({method:'giftClaim',token:gift.token},'new-family');assert.equal(f.room(id).home.family.kittens.length,47);
 s=await f.action('owner','family_help');assert.equal(s.home.family.kittens.length,48);assert.equal(s.home.family.feedingProgress,0);assert.equal(s.home.family.birthCount,1);const baby=s.home.family.kittens.find(c=>c.birthOrigin==='community');assert.ok(baby&&typeof baby.name==='string'&&baby.name.length);assert.match(baby.diary[0].text,/共同/);
 const founder=f.data.get(collections.invites+':mw-founder-pair-v1').roomId;await f.call({method:'nurseryRoom',visitRoom:founder},'pool-watch');const pool=f.room(founder);while(pool.home.family.kittens.length<48)pool.home.family.kittens.push({...pool.home.family.kittens[0],id:'pool-full-'+pool.home.family.kittens.length});pool.home.family.feedingProgress=11;
 s=await f.action('owner','family_help',{},undefined,founder);assert.equal(s.home.family.kittens.length,48);assert.equal(s.home.family.feedingProgress,12);
});
test('visitor petting contributes only the first three successful daily actions across rooms and never substitutes adoption credits',async()=>{
 const f=fixture(),normal=await ordinaryPair(f),founder=f.data.get(collections.invites+':mw-founder-pair-v1').roomId;
 f.room(normal).home.family.parents[0].sleeping=true;await assert.rejects(f.action('pet-visitor','pet',{catId:'cat-boy',nurseryPetCredit:true},undefined,normal));f.room(normal).home.family.parents[0].sleeping=false;
 for(let i=0;i<3;i++){const s=await f.action('pet-visitor','pet',{catId:'cat-boy',nurseryPetCredit:true},undefined,normal);assert.equal(s.home.family.feedingProgress,i+1);assert.equal(s.nurseryPetRemaining,2-i);assert.equal(s.adoption.credits,0);}
 const before=f.room(founder).home.family.feedingProgress;const s=await f.action('pet-visitor','pet',{catId:'cat-boy',nurseryPetCredit:true},undefined,founder);assert.equal(s.home.family.feedingProgress,before);assert.equal(s.nurseryPetRemaining,0);assert.equal(s.adoption.credits,0);
 f.advance(86400000);const next=await f.action('pet-visitor','pet',{catId:'cat-boy'},undefined,founder);assert.equal(next.home.family.feedingProgress,before+1);assert.equal(next.nurseryPetRemaining,2);
});
test('visitors can bring a founder breed pool above its initial forty through genuine shared care',async()=>{
 const f=fixture(),source=await f.pair();await f.call({method:'nurseryRoom'},'owner');for(const uid of ['helper-one','helper-two','helper-three','helper-four'])for(let i=0;i<3;i++)await f.action(uid,'family_help',{},undefined,source);
 const cats=f.room(source).home.family.kittens;assert.ok(cats.length>40&&cats.length<=42);assert.ok(cats.some(c=>c.birthOrigin==='community'));assert.equal(new Set(cats.map(c=>c.breedId)).size,40);
});
test('a prepared litter waits at 48 and fits exactly one freed slot without losing its pending state',async()=>{
 const f=fixture(),id=await ordinaryPair(f),room=f.room(id);room.home.family.bond=30;room.home.family.nestBuilt=true;await f.action('owner','start_litter');const family=f.room(id).home.family;family.pending.expected=2;family.pending.warmth=4;family.kittens=Array.from({length:48},(_,i)=>({...family.parents[i%2],id:'pending-full-'+i,name:'小宝宝',generation:1,growth:0}));family.feedingProgress=12;
 await assert.rejects(f.action('owner','welcome_kittens'),/住满/);assert.equal(f.room(id).home.family.pending.expected,2);assert.equal(f.room(id).home.family.feedingProgress,12);
 const parsed=require('../server/rules/backup').parseBackup({home:f.room(id).home,items:[]});assert.equal(parsed.home.family.kittens.length,48);assert.equal(parsed.home.family.feedingProgress,12);assert.equal(parsed.home.family.pending.expected,2);
 await f.call({method:'createRoom'},'pending-recipient');const gift=await f.call({method:'giftCreate',catId:'pending-full-0'},'partner');await f.call({method:'giftClaim',token:gift.token},'pending-recipient');await f.action('owner','welcome_kittens');assert.equal(f.room(id).home.family.kittens.length,48);assert.equal(f.room(id).home.family.pending,null);assert.equal(f.room(id).home.family.kittens.filter(c=>c.birthOrigin==='community').length,1);
});


test('steady founder reads and conditional sync do not write or open transactions',async()=>{
 const f=fixture();await f.pair();await f.call({method:'nurseryRoom'},'owner');
 const first=await f.call({method:'getHome'},'owner');f.resetStats();
 for(let i=0;i<5;i++){const reply=await f.call({method:'getHome',syncToken:first.syncToken},'owner');assert.equal(reply.unchanged,true);assert.equal(reply.home,undefined);assert.equal(reply.items,undefined);assert.equal(reply.version,first.version);}
 assert.deepEqual(f.stats,{writes:0,transactions:0});
 await f.action('partner','pet',{catId:'cat-boy'});
 const changed=await f.call({method:'getHome',syncToken:first.syncToken},'owner');assert.ok(changed.home);assert.ok(changed.version>first.version);
});
test('sync tokens isolate viewers, personal balances and daily changes',async()=>{
 const f=fixture(),id=await f.pair();const owner=await f.call({method:'getHome'},'owner');await f.call({method:'createRoom'},'visitor');
 const guest=await f.call({method:'getHome',visitRoom:id,syncToken:owner.syncToken},'visitor');assert.equal(guest.role,'guest');assert.ok(guest.home);assert.deepEqual(guest.items,[]);
 const same=await f.call({method:'getHome',visitRoom:id,syncToken:guest.syncToken},'visitor');assert.equal(same.unchanged,true);
 f.data.get(collections.users+':visitor').fishBalance+=7;
 const balance=await f.call({method:'getHome',visitRoom:id,syncToken:guest.syncToken},'visitor');assert.ok(balance.home);assert.equal(balance.home.coins,guest.home.coins+7);assert.equal(balance.version,guest.version);
 f.advance(86400000);const tomorrow=await f.call({method:'getHome',syncToken:owner.syncToken},'owner');assert.ok(tomorrow.home);
});
test('photo links are reused until cache expiry and never exposed to visitors',async()=>{
 const f=fixture(),id=await f.pair();await f.call({method:'saveMemory',requestId:'req-cache-photo',payload:{kind:'photo',title:'照片',imageBase64:png}},'owner');const count=f.urlCalls();
 const home=await f.call({method:'getHome'},'owner');assert.ok(home.items[0].mediaURL);await f.action('partner','pet',{catId:'cat-boy'});assert.equal(f.urlCalls(),count);
 const guest=await f.call({method:'getHome',visitRoom:id},'visitor');assert.deepEqual(guest.items,[]);assert.equal(f.urlCalls(),count);
 f.advance(120001);await f.call({method:'getHome'},'owner');assert.equal(f.urlCalls(),count+1);
});

test('collection updates notify only the actual partner, deduplicate saves and acknowledge only displayed messages',async()=>{
 const f=fixture(),id=await f.pair();const save=await f.call({method:'saveMemory',requestId:'req-letter-first',payload:{kind:'note',title:'给你的小纸条',body:'今天也想你'}},'owner');assert.deepEqual(save.notifications,[]);
 await f.call({method:'saveMemory',requestId:'req-letter-first',payload:{kind:'note',title:'给你的小纸条',body:'今天也想你'}},'owner');
 let peer=await f.call({method:'getHome'},'partner');assert.equal(peer.notifications.length,1);assert.equal(peer.notifications[0].read,false);assert.equal(peer.notifications[0].to,undefined);const first=peer.notifications[0].id;
 await f.call({method:'saveMemory',requestId:'req-wish-first',payload:{kind:'wish',title:'一起看海',body:'今年夏天'}},'owner');
 peer=await f.call({method:'readMemoryNotices',ids:[first]},'partner');assert.equal(peer.notifications.find(n=>n.id===first).read,true);assert.equal(peer.notifications.filter(n=>!n.read).length,1);
 const wish=peer.items.find(i=>i.kind==='wish');await f.call({method:'editMemory',requestId:'req-wish-done',payload:{id:wish.id,done:true}},'owner');
 peer=await f.call({method:'getHome'},'partner');assert.equal(peer.notifications[0].change,'completed');
 await f.call({method:'editMemory',requestId:'req-note-remove',payload:{id:save.items[0].id,remove:true}},'owner');peer=await f.call({method:'getHome'},'partner');assert.equal(peer.notifications[0].change,'removed');assert.ok(!peer.items.some(i=>i.id===save.items[0].id));
 const guest=await f.call({method:'getHome',visitRoom:id},'stranger');assert.deepEqual(guest.notifications,[]);await assert.rejects(f.call({method:'readMemoryNotices',visitRoom:id,ids:[first]},'stranger'));
 const owner=await f.call({method:'readMemoryNotices',ids:peer.notifications.map(n=>n.id)},'owner');assert.deepEqual(owner.notifications,[]);peer=await f.call({method:'getHome'},'partner');assert.equal(peer.notifications[0].read,false);
});
test('solo collection records have no delivery notices and history is bounded',async()=>{
 const f=fixture();await f.call({method:'createRoom'},'solo');const s=await f.call({method:'saveMemory',requestId:'req-solo-wish',payload:{kind:'wish',title:'旅行'}},'solo');assert.deepEqual(s.notifications,[]);
 const id=await f.pair();for(let i=0;i<65;i++)await f.call({method:'saveMemory',requestId:'req-many-notes-'+i,payload:{kind:'note',title:'纸条'+i}},'owner');assert.equal(f.room(id).memoryNotices.length,60);
});

test('friends add their own shared 30 growth after owner 60, each helper contributes at most 10, and request retries do not count twice',async()=>{
 const f=fixture(),id=await f.pair();let cat=f.room(id).home.family.parents[0];cat.growth=0;cat.growthRevision=2;
 for(let i=0;i<30;i++)await f.action('owner','pet',{catId:cat.id});assert.equal(f.room(id).home.family.parents[0].growth,60);
 for(let u=0;u<4;u++)for(let i=0;i<6;i++)await f.action('helper-'+u,'pet',{catId:cat.id,helperKey:'forged-'+i},'req-helper-'+u+'-'+i,id);
 cat=f.room(id).home.family.parents[0];assert.equal(cat.growth,90);assert.equal(cat.careXp,60);assert.equal(cat.friendCare.total,30);assert.ok(Object.values(cat.friendCare.users).every(n=>n<=10));
 await f.action('helper-0','pet',{catId:cat.id},'req-helper-0-0',id);assert.equal(f.room(id).home.family.parents[0].growth,90);
 f.advance(86400000);await f.action('helper-0','pet',{catId:cat.id},'req-helper-newday',id);cat=f.room(id).home.family.parents[0];assert.equal(cat.friendCare.total,2);assert.equal(cat.careXp,0);
});
test('founder catalog upgrade preserves old cats, groups legacy coats and seeds only once',async()=>{
 const {breeds,canonicalId}=require('../js/rules/cat-breeds'),f=fixture(),id=await f.pair(),room=f.room(id);room.founderBreedPoolActivated=true;room.home.family.founderBreedPool=true;delete room.home.family.breedCatalogRevision;
 room.home.family.kittens=['british-blue','british-golden','domestic-tabby','domestic-orange','domestic-calico'].map((breedId,i)=>({...room.home.family.parents[0],id:'old-'+i,generation:1,breedId,growth:24}));
 const s=await f.call({method:'getHome'},'owner');assert.equal(new Set(s.home.family.kittens.map(c=>canonicalId(c.breedId))).size,40);assert.equal(s.home.family.kittens.length,43);for(let i=0;i<5;i++)assert.ok(s.home.family.kittens.some(c=>c.id==='old-'+i));
 assert.equal(s.home.family.parents[0].breedId,'british-golden');assert.equal(s.home.family.parents[1].breedId,'ragdoll');
 const removed=f.room(id).home.family.kittens.pop();f.resetStats();const next=await f.call({method:'getHome'},'owner');assert.ok(!next.home.family.kittens.some(c=>c.id===removed.id));assert.deepEqual(f.stats,{writes:0,transactions:0});assert.equal(breeds.length,40);
});

test('hearts create a private partner notice once and do not notify the sender',async()=>{
 const f=fixture(),id=await f.pair();const me=await f.action('owner','hug',{kind:'hug'},'req-heart-notice');assert.deepEqual(me.notifications,[]);await f.action('owner','hug',{kind:'hug'},'req-heart-notice');const peer=await f.call({method:'getHome'},'partner');assert.equal(peer.notifications.length,1);assert.equal(peer.notifications[0].kind,'heart');const guest=await f.call({method:'getHome',visitRoom:id},'other');assert.deepEqual(guest.notifications,[]);
});

test('chat persona uses authoritative selected-cat breed, stage and stable individuality rather than client-forged fields',async()=>{
 const requests=[],f=fixture({getApiKey:()=> 'test-key',requestAI:async input=>{requests.push(input);return '我是布偶猫。';}}),id=await f.pair();
 const {makeCat}=require('../server/rules/cat-family'),{personality}=require('../server/rules/cat-life');const cat={...makeCat('persona-baby','小奶盖','girl',dayKey(),1),growth:250,breedId:'ragdoll'};f.room(id).home.family.kittens.push(cat);
 await f.call({method:'chatSend',visitRoom:id,catId:cat.id,message:'你是什么猫？',history:[],profile:{breed:'狗',name:'伪造'},breed:'狗'},'viewer');let profile=requests[0].profile;assert.equal(profile.breed,'布偶猫');assert.equal(profile.coat,'蓝双色');assert.equal(profile.name,'小奶盖');assert.equal(profile.stage,'幼猫');assert.equal(profile.character,personality(cat).name);assert.equal(profile.likes,personality(cat).like);assert.equal(JSON.stringify(profile).includes('伪造'),false);
 const stored=f.room(id).home.family.kittens.find(c=>c.id===cat.id);stored.name='奶糖';stored.growth=800;await f.call({method:'chatSend',visitRoom:id,catId:cat.id,message:'你叫什么名字？',history:[]},'viewer');assert.equal(requests[1].profile.name,'奶糖');assert.equal(requests[1].profile.stage,'成年猫');assert.equal(requests[1].profile.character,profile.character);
 await f.call({method:'chatSend',visitRoom:id,catId:'cat-boy',message:'你是什么猫？',history:[]},'viewer');assert.equal(requests[2].profile.breed,'英国短毛猫');assert.equal(requests[2].profile.coat,'金渐层');assert.notEqual(requests[2].profile.name,'奶糖');
});
