const {catPersona}=require('./cat-persona');
const {ADULT_GROWTH,MAX_GROWTH,migrateGrowth}=require('./rules/growth-policy');
const {BABY_LIMIT,RESIDENT_LIMIT,PET_NURSERY_DAILY_LIMIT}=require('./rules/nursery-policy');
const {breeds,breedFor,canonicalId}=require('./rules/cat-breeds');
const {GAME_FISH_DAILY_LIMIT,GAME_REWARD_ROUNDS,gameRewardState,gameReward}=require('./rules/economy');
'use strict';
const nodeCrypto=require('crypto');
const {initialHome,applyAction,dayKey}=require('./rules/home-state');
const {normalizeHome,visibleHome,resetAdventure}=require('./rules/gameplay');
const {syncPrimary,stageIndex,familyRequirements,makeCat}=require('./rules/cat-family');
const {parseBackup}=require('./rules/backup');
const {generateCatReply,MODEL}=require('./chat-ai');
const {generateDailyContent}=require('./chat-ai');
const {generateCloudCatReply,generateCloudDailyContent,MODEL:CLOUD_MODEL}=require('./cloud-ai');
const {fallbackContent}=require('./rules/daily-content');
const clone=x=>JSON.parse(JSON.stringify(x));
const collections={users:'mw_users',rooms:'mw_rooms',invites:'mw_invites'};
const allowedActions=new Set(['daily_story','feed','pet','family_help','sleep','checkin','shop','settings','cat_rename','build_nest','start_litter','care_nest','welcome_kittens','hug','catch','game','quest_claim','duet_submit']);
const guestActions=new Set(['feed','pet','family_help','catch','game']);
const CHAT_MIN_HUNGER=40,CHAT_HUNGER_COST=3,AD_REWARD=20,AD_DAILY_LIMIT=6;
function fault(code,message){return Object.assign(new Error(message),{code});}
async function readDoc(ref){try{const r=await ref.get(),found=Array.isArray(r.data)?r.data[0]:r.data;if(!found)return null;const {_id,_openid,...value}=found;if(value.home&&value.home.family)for(const cat of [...value.home.family.parents,...value.home.family.kittens])migrateGrowth(cat);if(value.cat)migrateGrowth(value.cat);return value;}catch(e){if(String(e.errCode||e.code)==='-502005'||e.code==='DATABASE_DOCUMENT_NOT_EXIST'||/document.*(not exist|does not exist)/i.test(e.message||e.errMsg||''))return null;throw e;}}
function roleIn(room,uid){if(room&&room.members.me===uid)return 'me';if(room&&room.members.you===uid)return 'you';if(room&&Array.isArray(room.guests)&&room.guests.includes(uid))return 'guest';throw fault('FORBIDDEN','你还没有这间小屋的钥匙');}
function membersOnly(role){if(role==='guest')throw fault('FORBIDDEN','访客只能喂猫、摸猫、玩游戏和进入猫咪聊天');}
function guestView(home,day=dayKey()){const h=clone(home);h.me='小屋主人';h.you='另一位主人';h.together='';h.love=0;h.best=0;h.visits={me:0,you:0};h.checkins={};h.gameDays={};h.adventure=resetAdventure(day);h.family.events=[];h.family.legacy=[];return h;}
function cleanText(value,max,required=false){const out=String(value===undefined?'':value).trim();if((required&&!out)||out.length>max)throw fault('BAD_INPUT',`请填写${required?'1～':''}${max}个字以内的内容`);return out;}
function imageBytes(base64){if(typeof base64!=='string'||base64.length>1500000||!/^[A-Za-z0-9+/]+={0,2}$/.test(base64))throw fault('BAD_IMAGE','照片格式不正确，请重新选择');const bytes=Buffer.from(base64,'base64');if(bytes.length>1024*1024||bytes.length<16)throw fault('BAD_IMAGE','照片需要压缩到 1MB 以内');let ext='';if(bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff)ext='jpg';else if(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))ext='png';else if(bytes.subarray(0,4).toString()==='RIFF'&&bytes.subarray(8,12).toString()==='WEBP')ext='webp';if(!ext)throw fault('BAD_IMAGE','请选择 JPG、PNG 或 WebP 照片');return {bytes,ext};}
function createHandler({db,storage,now=()=>Date.now(),requestAI=generateCatReply,requestDaily=generateDailyContent,getApiKey=()=>process.env.OPENAI_API_KEY,getProvider=()=>process.env.MW_AI_PROVIDER==='openai'?'openai':'hunyuan',getCloudAI=()=>null,requestCloudAI=generateCloudCatReply,requestCloudDaily=generateCloudDailyContent}){

 const doc=(collection,id,tx=db)=>tx.collection(collection).doc(id);
 const today=()=>dayKey(new Date(now()));
 function guestWallet(user,roomId){user.visitorWallets=user.visitorWallets||{};if(!user.visitorWallets[roomId])user.visitorWallets[roomId]={helped:0,day:today(),catchPlays:0,gamePlays:0,updatedAt:now()};const w=user.visitorWallets[roomId];if(w.day!==today()){w.day=today();w.catchPlays=0;w.gamePlays=0;}w.updatedAt=now();const ids=Object.keys(user.visitorWallets);if(ids.length>30)for(const old of ids.filter(id=>id!==roomId).sort((a,b)=>(user.visitorWallets[a].updatedAt||0)-(user.visitorWallets[b].updatedAt||0)).slice(0,ids.length-30))delete user.visitorWallets[old];return w;}
 function personalFish(user,ownRoom,uid=''){
  if(Number.isSafeInteger(user.fishBalance)&&user.fishBalance>=0)return user.fishBalance;
  const guestFish=Math.max(0,...Object.values(user.visitorWallets||{}).map(w=>Number.isSafeInteger(w.fish)&&w.fish>=0?w.fish:0));
  const ownFish=ownRoom?Math.max(0,ownRoom.members.you?(uid===ownRoom.members.me?Math.ceil((ownRoom.home.coins||0)/2):Math.floor((ownRoom.home.coins||0)/2)):Math.floor(ownRoom.home.coins||0)):0;
  user.fishBalance=ownRoom?ownFish+guestFish:Math.max(15,guestFish);
  if(ownRoom)user.starterGranted=true;
  return user.fishBalance;
 }
 async function personalUser(uid,tx,room){const user=await readDoc(doc(collections.users,uid,tx))||{roomId:null};if(Number.isSafeInteger(user.fishBalance)&&user.fishBalance>=0)return user;const ownRoom=user.roomId?(user.roomId===room.id?room:await readDoc(doc(collections.rooms,user.roomId,tx))):null;personalFish(user,ownRoom,uid);return user;}
 function adQuota(usage,uid,purpose){
  const counts=usage.byPurpose&&usage.byPurpose[uid]||{fish:usage.users[uid]||0,growth:0,nursery:0};
  if((usage.users[uid]||0)>=AD_DAILY_LIMIT||purpose==='fish'&&(counts.fish||0)>=3)throw fault('AD_LIMIT','今天的广告奖励已领满：每人每屋总共 6 次，其中鱼干最多 3 次');return counts;
 }
 function checkNurseryReward(room){
  if(room.founderNursery)throw fault('BAD_INPUT','创世猫屋不需要育儿奶，继续照顾即可迎接宝宝');
  const req=familyRequirements(room.home,today(),now()),family=room.home.family;
  if(!req.adult)throw fault('BAD_INPUT','先把公猫和母猫养成年，再领取育儿奶');
  if(!(family.birthCount||0))throw fault('BAD_INPUT','今天的第一窝免费，先攒满 12 次照顾，无需看广告');
  if(!req.litterLimit||(family.milkAdsCount||0)>=3)throw fault('AD_LIMIT','这间小屋今天的 3 份育儿奶已领完，先照顾宝宝或让朋友领养');
 }
 function checkGrowthCat(room,role,catId,day){
  membersOnly(role);const cat=[...room.home.family.parents,...room.home.family.kittens].find(cat=>cat.id===catId);
  if(!cat)throw fault('NOT_FOUND','这只小猫已经不在小屋里');if(cat.growth>=ADULT_GROWTH)throw fault('GROWTH_UNAVAILABLE','这只猫已经成年，不需要广告加速');
  if(cat.sleeping||cat.hunger<40||cat.mood<60||cat.energy<50)throw fault('CAT_NOT_READY','先喂饱、摸摸头并让小猫休息好，再来加速成长');
  if(cat.boostDay!==day){cat.boostDay=day;cat.boostCount=0;}if((cat.boostCount||0)>=3)throw fault('BOOST_LIMIT','这只猫今天已经加速 3 次，两位主人共用次数，明天再来');return cat;
 }
 async function membership(uid,tx=db,visitRoom=''){
  if(visitRoom){if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(visitRoom))throw fault('BAD_INPUT','访客小屋链接不正确');const room=await readDoc(doc(collections.rooms,visitRoom,tx));if(!room)throw fault('NO_ROOM','这间小屋已经关门啦');const role=room.members.me===uid?'me':room.members.you===uid?'you':'guest';return {room,role,user:null};}
  const user=await readDoc(doc(collections.users,uid,tx));if(!user||!user.roomId)throw fault('NO_ROOM','先创建一间小屋，或输入另一位的邀请口令');const room=await readDoc(doc(collections.rooms,user.roomId,tx));if(!room)throw fault('NO_ROOM','这间小屋已关闭，请重新创建');return {user,room,role:roleIn(room,uid)};
 }
 function refillFounderBabies(room){
  if(!room.founderNursery||room.founderBreedPoolActivated!==true)return false;
  const family=room.home.family;if(family.breedCatalogRevision===2)return false;let changed=true;family.founderBreedPool=true;
  for(const cat of family.kittens)if(!cat.breedId){cat.breedId=breedFor(cat).id;changed=true;}
  for(const [i,breed] of breeds.entries())if(family.kittens.length<BABY_LIMIT&&!family.kittens.some(cat=>canonicalId(cat.breedId)===breed.id)){
   const seq=family.breedPoolSerial||0;family.breedPoolSerial=seq+1;const cat=makeCat(nodeCrypto.randomUUID(),breed.coat+'宝宝',seq%2?'girl':'boy',today(),1);cat.breedId=breed.id;family.kittens.push(cat);changed=true;
  }family.breedCatalogRevision=2;return changed;
 }
 function founderNeedsUpdate(room){const family=room.home&&room.home.family;if(!family)return false;return !room.founderNursery||family.founderNursery!==true||room.founderNamesRevision!==2||room.founderAdultRevision!==1||room.founderBreedPoolActivated===true&&(!family.founderBreedPool||family.breedCatalogRevision!==2);}
 async function promoteFounder(tx,room){
  const founder=await readDoc(doc(collections.invites,'mw-founder-pair-v1',tx));if(!founder||founder.roomId!==room.id)return;
  const original=(room.home&&room.home.family&&room.home.family.parents||[]).filter(cat=>(cat.id==='cat-boy'&&cat.sex==='boy'||cat.id==='cat-girl'&&cat.sex==='girl')&&cat.generation===0);if(original.length!==2)return;
  let changed=room.founderNursery!==true||room.home.family.founderNursery!==true;room.founderNursery=true;room.home.family.founderNursery=true;if(refillFounderBabies(room))changed=true;
  if(room.founderNamesRevision!==2){for(const cat of original)cat.name=cat.sex==='boy'?'公猫':'母猫';room.founderNamesRevision=2;syncPrimary(room.home);changed=true;}
  if(room.founderAdultRevision!==1){const adultDay=dayKey(new Date(now()-8*86400000));for(const cat of original){cat.growth=Math.max(ADULT_GROWTH,cat.growth||0);if(!cat.bornOn||cat.bornOn>adultDay)cat.bornOn=adultDay;}syncPrimary(room.home);room.founderAdultRevision=1;changed=true;}
  if(changed){room.version=(room.version||0)+1;await doc(collections.rooms,room.id,tx).set({data:room});}
 }
 async function reserveExistingFounder(room){
  if(!room.home||!room.home.family||room.home.family.parents.length<2)return;
  const founder=await readDoc(doc(collections.invites,'mw-founder-pair-v1'));if(founder&&(founder.roomId!==room.id||!founderNeedsUpdate(room)))return;
  if(!founder&&!room.home.family.parents.some(c=>c.id==='cat-boy'&&c.generation===0))return;
  const updated=await db.runTransaction(async tx=>{const current=await readDoc(doc(collections.rooms,room.id,tx));if(!current)return room;const ref=doc(collections.invites,'mw-founder-pair-v1',tx);if(!await readDoc(ref))await ref.set({data:{kind:'founder',roomId:room.id,createdAt:room.createdAt||now()}});await promoteFounder(tx,current);return current;});Object.assign(room,updated);
 }
 function ownedCatIds(room,uid){
  const guardians=room.catGuardians||{},parents=room.home.family.parents;
  return [...parents,...room.home.family.kittens].filter(cat=>cat.generation>0&&(guardians[cat.id]===uid||!guardians[cat.id]&&parents.includes(cat)&&uid===(parents.indexOf(cat)===0?room.members.me:room.members.you||room.members.me))).map(cat=>cat.id);
 }
 function recipientRoomCheck(room,uid,incoming){
  const cats=[...room.home.family.parents,...room.home.family.kittens],owned=ownedCatIds(room,uid);
  if(room.home.family.parents.length>=2)throw fault('NEED_PARTNER','这间小屋已经有两只常住猫啦；先一起照顾它们和出生的宝宝');
  if(room.members.you){if(owned.length)throw fault('NEED_PARTNER','你已经领养了一只猫啦；这间共养小屋由另一位主人领养下一只');return;}
  if(!cats.length)return;
  if(cats.length!==1||owned.length!==1||cats[0].generation===0)throw fault('NEED_PARTNER','你的小屋已经有两只猫啦；先照顾好它们');
  const first=cats[0],care=room.home.visits&&room.home.visits.me||0;
  if(first.growth<ADULT_GROWTH||care<30)throw fault('NOT_READY',`独自迎接第二只猫需要先把第一只养到成长值 800，并亲自喂食或摸头累计 30 次；目前成长 ${first.growth}/800、照顾 ${care}/30`);
 }
 function resetAdoptionCredits(user){for(const wallet of Object.values(user.visitorWallets||{}))wallet.helped=0;}
 const fosterRef=(id,tx=db)=>doc(collections.invites,'foster-'+id,tx);
 function fosterView(foster,uid){const mine=foster.guardians.includes(uid),offered=foster.proposal&&foster.proposal.kind==='newPartner'&&foster.proposal.recipient===uid;return {id:foster.id,cat:normalizeHome({...clone(initialHome),family:{parents:[clone(foster.cat)],kittens:[],events:[]}},today()).family.parents[0],state:foster.state,createdAt:foster.createdAt,mine,mySide:mine?foster.guardians.indexOf(uid)===0?'first':'second':'',otherSide:mine?foster.guardians.indexOf(uid)===0?'second':'first':'',offered:!!offered,proposal:mine||offered?foster.proposal&&{kind:foster.proposal.kind,side:foster.proposal.side,approvals:[!!foster.proposal.approvals[foster.guardians[0]],!!foster.proposal.approvals[foster.guardians[1]]]}:null};}
 async function finishFoster(tx,foster){for(const uid of foster.guardians){const ref=doc(collections.users,uid,tx),user=await readDoc(ref);if(user){user.fosterIds=(user.fosterIds||[]).filter(id=>id!==foster.id);await ref.set({data:user});}}}
 async function clearOffer(tx,foster){const recipient=foster.proposal&&foster.proposal.kind==='newPartner'&&foster.proposal.recipient;if(!recipient)return;const ref=doc(collections.users,recipient,tx),user=await readDoc(ref);if(user){user.fosterOffers=(user.fosterOffers||[]).filter(id=>id!==foster.id);await ref.set({data:user});}}
 async function transferFoster(tx,foster,recipient){
  const person=await readDoc(doc(collections.users,recipient,tx)),room=person&&person.roomId&&await readDoc(doc(collections.rooms,person.roomId,tx));
  if(!room||room.members.me!==recipient&&room.members.you!==recipient)throw fault('ROOM_CHANGED','接手人的小屋已改变，请重新商量');
  room.home=normalizeHome(clone(room.home),today());const family=room.home.family,number=family.parents.length+family.kittens.length;
  if(number>=RESIDENT_LIMIT||family.kittens.length>=BABY_LIMIT)throw fault('CAT_FULL','接手人的猫屋已满，先为宝宝腾出位置');
  if([...family.parents,...family.kittens].some(cat=>cat.id===foster.cat.id))throw fault('CAT_EXISTS','这只小猫已经在接手人的小屋里了，请刷新后重试');
  const cat={...foster.cat,sleeping:false,lastGrowthDay:today()};
  if(family.parents.length<2)family.parents.push(cat);else family.kittens.push(cat);
  room.catGuardians=room.catGuardians||{};room.catGuardians[cat.id]=recipient;
  family.events.unshift({id:nodeCrypto.randomUUID(),text:`${cat.name}从创世屋寄养区回家了。`,at:new Date(now()).toISOString()});family.events=family.events.slice(0,10);
  syncPrimary(room.home);room.version=(room.version||0)+1;await doc(collections.rooms,room.id,tx).set({data:room});return room;
 }
 function memoryNotice(room,role,item,change){
  const to=room.members[role==='me'?'you':'me'];if(!to)return;
  room.memoryNotices=[{id:nodeCrypto.randomUUID(),to,from:room.members[role],sender:room.home[role],itemId:item.id,kind:item.kind,title:item.title,change,at:now(),read:false},...(room.memoryNotices||[])].slice(0,60);
 }
 function noticesFor(room,uid){return (room.memoryNotices||[]).filter(n=>n.to===uid&&n.from!==uid).map(({to,from,...n})=>n);}
 const mediaLinks=new Map(),MEDIA_CACHE_MS=120000;
 function syncToken(room,role,uid,user){const wallet=user.visitorWallets&&user.visitorWallets[room.id];return nodeCrypto.createHash('sha256').update(JSON.stringify(['catalog-growth-v2',uid,room.id,role,room.version||0,today(),user.roomId,user.fishBalance,wallet&&wallet.helped||0,user.gameRewardUsage,user.nurseryPetUsage,user.fosterIds,user.fosterOffers,!!process.env.MW_REWARDED_AD_UNIT_ID,role!=='guest'&&(room.items||[]).some(i=>i.media)?Math.floor(now()/60000):0])).digest('hex');}
 async function publicSnapshot(room,role,message='',thisUid='',viewerHint=null){
  const items=role==='guest'?[]:clone(room.items||[]),files=[...new Set(items.filter(i=>i.media).map(i=>i.media))],urls={},missing=[];
  for(const fileID of files){const cached=mediaLinks.get(fileID);if(cached&&cached.expires>now())urls[fileID]=cached.url;else {mediaLinks.delete(fileID);missing.push(fileID);}}
  for(let i=0;i<missing.length;i+=50){try{const r=await storage.getTempFileURL({fileList:missing.slice(i,i+50)});for(const f of r.fileList||[])if(f.tempFileURL&&(!f.status||f.status===0)){urls[f.fileID]=f.tempFileURL;if(mediaLinks.size>=500)mediaLinks.delete(mediaLinks.keys().next().value);mediaLinks.set(f.fileID,{url:f.tempFileURL,expires:now()+MEDIA_CACHE_MS});}}catch(error){console.warn('MW_MEDIA_URL_FAILED',{code:error.code||error.errCode||'TEMP_URL_UNAVAILABLE'});}}
  for(const item of items){item.mediaURL=item.media?urls[item.media]||'':'';item.needsPhoto=item.kind==='photo'&&!item.media;}
  const viewer=role==='guest'?thisUid:room.members[role],viewerUser=viewerHint||(viewer?await personalUser(viewer,db,room):{roomId:null}),home=normalizeHome(clone(room.home),today()),wallet=role==='guest'?guestWallet(viewerUser,room.id):null;home.family.founderNursery=room.founderNursery===true;home.coins=viewerUser.fishBalance;
  const daily=room.daily&&room.daily.day===today()&&room.daily.status==='ready'?room.daily:fallbackContent(today());
  const plan=room.catPlan&&room.catPlan.kind==='graduate'?room.catPlan:null;
  const adoption=role==='guest'?{helpers:room.helperTotal||0,credits:wallet.helped||0,availableBoys:home.family.kittens.filter(c=>c.sex==='boy').length,availableGirls:home.family.kittens.filter(c=>c.sex==='girl').length}:{helpers:room.helperTotal||0,plan:plan?{kind:plan.kind,catId:plan.catId,approvals:plan.approvals}:null,legacy:home.family.legacy||[],legacyTotal:home.family.legacyTotal||0};
  const gameUsage=gameRewardState(viewerUser,today());
  return {notifications:role==='guest'?[]:noticesFor(room,viewer),syncToken:syncToken(room,role,viewer,viewerUser),nurseryPetRemaining:Math.max(0,PET_NURSERY_DAILY_LIMIT-(viewerUser.nurseryPetUsage&&viewerUser.nurseryPetUsage.day===today()?viewerUser.nurseryPetUsage.count:0)),adsReady:/^adunit-[A-Za-z0-9_-]+$/.test(process.env.MW_REWARDED_AD_UNIT_ID||''),gameRewards:{fish:gameUsage.fish,limit:GAME_FISH_DAILY_LIMIT,catchRemaining:Math.max(0,GAME_REWARD_ROUNDS-gameUsage.catch),gameRemaining:Math.max(0,GAME_REWARD_ROUNDS-gameUsage.game)},fosterCount:(viewerUser.fosterIds||[]).length||0,fosterOfferCount:(viewerUser.fosterOffers||[]).length||0,hasOwnHome:!!(role==='guest'&&viewerUser.roomId&&viewerUser.roomId!==room.id),myCatIds:role==='guest'?[]:ownedCatIds(room,room.members[role]),roomId:room.id,role,paired:!!room.members.you,owner:role==='me',home:role==='guest'?guestView(home,today()):visibleHome(home,role),items,daily:role==='guest'?null:{day:daily.day,source:daily.source,questions:daily.questions},adoption,version:room.version||0,serverNow:now(),message};
 }
 async function mutate(uid,event,fn){
  const requestId=String(event.requestId||'');if(!/^[a-zA-Z0-9-]{8,80}$/.test(requestId))throw fault('BAD_INPUT','这次操作缺少编号，请重试');
  const result=await db.runTransaction(async tx=>{const {room,role}=await membership(uid,tx,event.visitRoom);await promoteFounder(tx,room);if(role==='guest'&&!guestActions.has(event.action)&&!(event.action==='sleep'&&room.founderNursery===true))throw fault('FORBIDDEN','访客只能照顾猫和玩小游戏');if(role==='guest'&&event.method!=='action')throw fault('FORBIDDEN','访客不能修改小屋收藏');const key=uid+':'+requestId,old=(room.receipts||[]).find(r=>r.key===key);if(old)return {room,role,message:old.message,duplicate:true};room.home=normalizeHome(clone(room.home),today());const walletUser=await personalUser(uid,tx,room),wallet=role==='guest'?guestWallet(walletUser,room.id):null,legacyCoins=room.home.coins,beforeFish=walletUser.fishBalance;room.home.coins=beforeFish;room.home.family.founderNursery=room.founderNursery===true;const message=fn(room,role,wallet,walletUser);room.home.family.founderNursery=room.founderNursery===true;walletUser.fishBalance=room.home.coins;
   if(room.members.you&&['quest_claim','duet_submit'].includes(event.action)&&walletUser.fishBalance>beforeFish){const other=room.members[role==='me'?'you':'me'],otherUser=await personalUser(other,tx,room),share=Math.floor((walletUser.fishBalance-beforeFish)/2);walletUser.fishBalance-=share;otherUser.fishBalance+=share;await doc(collections.users,other,tx).set({data:otherUser});}
   room.home.coins=legacyCoins;room.version=(room.version||0)+1;room.receipts=[{key,message,at:now()},...(room.receipts||[])].slice(0,100);await doc(collections.rooms,room.id,tx).set({data:room});await doc(collections.users,uid,tx).set({data:walletUser});return {room,role,message,duplicate:false};});
  return result;
 }
 async function handle(event,uid){
  if(!uid)throw fault('UNAUTHENTICATED','请从抖音小游戏进入小屋');
  const method=event.method;
  if(method==='founderEntry'){
   const founder=await readDoc(doc(collections.invites,'mw-founder-pair-v1'));
   const room=founder&&await readDoc(doc(collections.rooms,founder.roomId));
   if(!room||![...(room.home.family.parents||[]),...(room.home.family.kittens||[])].length)throw fault('NO_FOUNDER','创世猫屋暂时未开放，请稍后再来');
   return {roomId:room.id};
  }
  if(method==='nurseryRoom'){
   const result=await db.runTransaction(async tx=>{const {room,role}=await membership(uid,tx,event.visitRoom);await promoteFounder(tx,room);if(room.founderNursery){room.founderBreedPoolActivated=true;refillFounderBabies(room);room.version=(room.version||0)+1;await doc(collections.rooms,room.id,tx).set({data:room});}return {room,role};});return publicSnapshot(result.room,result.role,'',uid);
  }
  if(method==='session'){const user=await readDoc(doc(collections.users,uid));if(!user||!user.roomId)return {roomId:null,role:null,paired:false};const {room,role}=await membership(uid);await reserveExistingFounder(room);return publicSnapshot(room,role);}
  if(method==='createRoom'){
   const id=nodeCrypto.randomUUID();const result=await db.runTransaction(async tx=>{const user=await readDoc(doc(collections.users,uid,tx))||{roomId:null};if(user.roomId){const room=await readDoc(doc(collections.rooms,user.roomId,tx));if(room)return {room,role:roleIn(room,uid)};}personalFish(user,null);if(!user.starterGranted){user.fishBalance+=105;user.starterGranted=true;}const founder=await readDoc(doc(collections.invites,'mw-founder-pair-v1',tx)),home=normalizeHome(clone(initialHome),today());if(founder){home.family.parents=[];home.family.kittens=[];home.family.events=[];home.family.bond=0;}else {for(const cat of home.family.parents){cat.bornOn=dayKey(new Date(now()-8*86400000));cat.lastGrowthDay=today();cat.growth=ADULT_GROWTH;}await doc(collections.invites,'mw-founder-pair-v1',tx).set({data:{kind:'founder',roomId:id,createdAt:now()}});}const room={id,members:{me:uid,you:null},guests:[],home,items:[],receipts:[],version:0,createdAt:now(),inviteDigest:null,guestInviteDigest:null,imported:false};await doc(collections.rooms,id,tx).set({data:room});await doc(collections.users,uid,tx).set({data:{...user,roomId:id}});return {room,role:'me',founder:!founder};});await reserveExistingFounder(result.room);return publicSnapshot(result.room,result.role,result.founder?'创始小屋有公猫和母猫；以后的小屋从领养开始':'小屋准备好了，去朋友家领养第一只小猫吧');
  }
  if(method==='visitRoom'){if(!event.roomId)throw fault('BAD_INPUT','访客小屋链接不正确');const {room,role}=await membership(uid,db,event.roomId);await reserveExistingFounder(room);return publicSnapshot(room,role,role==='guest'?'来陪公猫和母猫玩吧 🐾':'欢迎回到你们的小屋',uid);}
  if(method==='invite'){
   const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789',bytes=nodeCrypto.randomBytes(10),code=Array.from(bytes,b=>alphabet[b%alphabet.length]).join(''),digest=nodeCrypto.createHash('sha256').update(code).digest('hex'),expiresAt=now()+24*3600000;
   if(event.kind==='guest')throw fault('BAD_INPUT','访客点分享链接就能进入，无须口令');
   await db.runTransaction(async tx=>{const {room,role}=await membership(uid,tx);if(role!=='me')throw fault('FORBIDDEN','邀请口令由小屋创建者生成');if(room.members.you)throw fault('ROOM_FULL','你们已经一起住进来了');if(room.inviteDigest){const old=await readDoc(doc(collections.invites,room.inviteDigest,tx));if(old)await doc(collections.invites,room.inviteDigest,tx).remove();}room.inviteDigest=digest;await doc(collections.invites,digest,tx).set({data:{roomId:room.id,kind:'partner',expiresAt,used:false}});await doc(collections.rooms,room.id,tx).set({data:room});});return {code,expiresAt,kind:'partner'};
  }
  if(method==='joinPreview'){
   const code=String(event.code||'').trim().toUpperCase().replace(/\s/g,'');if(!/^[A-HJ-NP-Z2-9]{10}$/.test(code))throw fault('BAD_INVITE','请填写 10 位邀请口令');
   const digest=nodeCrypto.createHash('sha256').update(code).digest('hex');
   await db.runTransaction(async tx=>{const ref=doc(collections.users,uid,tx),user=await readDoc(ref)||{roomId:null};if(!user.previewWindow||now()-user.previewWindow>600000){user.previewWindow=now();user.previewAttempts=0;}if(user.previewAttempts>=8)throw fault('RATE_LIMIT','试了好多次啦，10 分钟后再试吧');user.previewAttempts++;await ref.set({data:user});});
   return db.runTransaction(async tx=>{const invite=await readDoc(doc(collections.invites,digest,tx));if(!invite||invite.kind!=='partner'||invite.used||invite.expiresAt<now())throw fault('BAD_INVITE','口令已过期或用过，请让对方重新生成');
    const room=await readDoc(doc(collections.rooms,invite.roomId,tx));if(!room||room.inviteDigest!==digest||room.members.you||room.members.me===uid)throw fault('BAD_INVITE','这把钥匙已经不能用了');
    const residentCats=[...room.home.family.parents,...room.home.family.kittens].map(cat=>({id:cat.id,name:cat.name,sex:cat.sex})),token=nodeCrypto.randomBytes(18).toString('hex'),ref=doc(collections.users,uid,tx),user=await readDoc(ref)||{roomId:null};
    user.pendingJoin={digest,roomId:room.id,catIds:residentCats.map(cat=>cat.id).sort(),token,expiresAt:now()+5*60000};await ref.set({data:user});return {roomName:room.home.roomName,residentCats,consentToken:token};
   });
  }
  if(method==='joinRoom'){
   const code=String(event.code||'').trim().toUpperCase().replace(/\s/g,'');if(!/^[A-HJ-NP-Z2-9]{10}$/.test(code))throw fault('BAD_INVITE','请填写 10 位邀请口令');
   await db.runTransaction(async tx=>{const u=await readDoc(doc(collections.users,uid,tx))||{roomId:null};if(!u.joinWindow||now()-u.joinWindow>600000){u.joinWindow=now();u.joinAttempts=0;}if(u.joinAttempts>=8)throw fault('RATE_LIMIT','试了好多次啦，10 分钟后再试吧');u.joinAttempts=(u.joinAttempts||0)+1;await doc(collections.users,uid,tx).set({data:u});});
   const digest=nodeCrypto.createHash('sha256').update(code).digest('hex');
   const joined=await db.runTransaction(async tx=>{
    const user=await readDoc(doc(collections.users,uid,tx)),invite=await readDoc(doc(collections.invites,digest,tx));
    if(!invite||invite.kind!=='partner'||invite.used||invite.expiresAt<now())throw fault('BAD_INVITE','口令已过期或用过，请让主人重新生成');
    const room=await readDoc(doc(collections.rooms,invite.roomId,tx));if(!room||room.inviteDigest!==digest||room.members.you||room.members.me===uid)throw fault('BAD_INVITE','这把钥匙已经不能用了');
    const pending=user&&user.pendingJoin,catIds=[...room.home.family.parents,...room.home.family.kittens].map(cat=>cat.id).sort();
    if(event.acceptResidentCats!==true||!pending||pending.digest!==digest||pending.roomId!==room.id||pending.expiresAt<now()||pending.token!==event.consentToken||JSON.stringify(pending.catIds)!==JSON.stringify(catIds))throw fault('CONSENT_REQUIRED','小屋的猫咪情况可能变了，请先查看屋里的猫并由你本人确认接纳');
    const ownerUser=await readDoc(doc(collections.users,room.members.me,tx));if(!ownerUser)throw fault('ROOM_CHANGED','小屋主人暂时无法加入，请刷新后重试');personalFish(ownerUser,room,room.members.me);
    if(user&&user.roomId){
     const donor=await readDoc(doc(collections.rooms,user.roomId,tx));
     if(!donor||donor.id===room.id||donor.members.me!==uid||donor.members.you)throw fault('MERGE_UNAVAILABLE','你的小屋已经配对，不能再合并');
     donor.home=normalizeHome(clone(donor.home),today());room.home=normalizeHome(clone(room.home),today());
     const owned=[...donor.home.family.parents,...donor.home.family.kittens],existing=[...room.home.family.parents,...room.home.family.kittens];
     if(!((owned.length===1&&existing.length===1)||(owned.length===0&&existing.length>=1))||donor.items.length||donor.home.family.pending||donor.catPlan||donor.imported)throw fault('MERGE_UNAVAILABLE','只能把单猫小屋合并到另一间单猫小屋，或带空屋加入已有猫的小屋；旧屋不能有私人收藏或待办');
     if(owned.length&&existing.some(cat=>cat.id===owned[0].id))throw fault('MERGE_UNAVAILABLE','两只猫的身份冲突，请联系客服处理');
     personalFish(user,donor,uid);
     room.catGuardians=room.catGuardians||{};if(existing[0].generation>0&&!room.catGuardians[existing[0].id])room.catGuardians[existing[0].id]=room.members.me;for(const cat of owned)room.catGuardians[cat.id]=uid;
     room.home.you=donor.home.me;room.home.visits.you=donor.home.visits.me;
     if(owned.length){room.home.family.parents.push(owned[0]);room.home.family.events.unshift({id:nodeCrypto.randomUUID(),text:`${owned[0].name}搬来和${existing[0].name}一起住啦。`,at:new Date(now()).toISOString()});room.home.family.events=room.home.family.events.slice(0,10);}
     // The old room is empty and has no private material. Its visit link is invalid after the move.
     if(donor.inviteDigest)await doc(collections.invites,donor.inviteDigest,tx).remove();
     await doc(collections.rooms,donor.id,tx).remove();
    }
    if(!user.roomId)personalFish(user,null);
    room.members.you=uid;room.inviteDigest=null;room.version++;invite.used=true;
    await doc(collections.invites,digest,tx).set({data:invite});await doc(collections.rooms,room.id,tx).set({data:room});await doc(collections.users,room.members.me,tx).set({data:ownerUser});await doc(collections.users,uid,tx).set({data:{...user,roomId:room.id,pendingJoin:null}});return {room,role:'you'};
   });return publicSnapshot(joined.room,joined.role,'两只猫终于住进同一间小屋啦 ♡');
  }
  if(method==='getHome'){const {room,role,user}=await membership(uid,db,event.visitRoom);await reserveExistingFounder(room);const viewer=user&&Number.isSafeInteger(user.fishBalance)&&user.fishBalance>=0?user:await personalUser(uid,db,room),token=syncToken(room,role,uid,viewer);if(typeof event.syncToken==='string'&&event.syncToken===token)return {unchanged:true,syncToken:token,roomId:room.id,role,version:room.version||0,serverNow:now()};return publicSnapshot(room,role,'',uid,viewer);}
  if(method==='catPlan'){
   const kind=String(event.kind||''),catId=String(event.catId||'');if(!['graduate','cancel'].includes(kind))throw fault('BAD_INPUT','请选择成年毕业或取消安排');
   const result=await db.runTransaction(async tx=>{const {room,role}=await membership(uid,tx);membersOnly(role);room.home=normalizeHome(clone(room.home),today());const f=room.home.family;let message='';
    if(kind==='cancel'){if(!room.catPlan)throw fault('NOT_FOUND','没有待处理的毕业');room.catPlan=null;message='已取消这次安排';}
    else {const cat=f.kittens.find(c=>c.id===catId);if(!cat)throw fault('NOT_FOUND','这只宝宝已经不在小屋里了');
     if(stageIndex(cat,today())!==3)throw fault('TOO_YOUNG','毕业留在家谱要等这只猫成年');
     const p=room.catPlan;if(p&&(p.kind!=='graduate'||p.catId!==catId))throw fault('PLAN_PENDING','先完成或取消上一项安排');
     if(p&&p.approvals[role])throw fault('ALREADY_APPROVED','你已经同意啦，等另一位确认');
     const plan=p||{kind:'graduate',catId,approvals:{me:false,you:false},at:now()};plan.approvals[role]=true;
     if(plan.approvals.me&&(!room.members.you||plan.approvals.you)){f.legacy=f.legacy||[];f.legacyTotal=(f.legacyTotal||0)+1;f.legacy.unshift({id:cat.id,name:cat.name,sex:cat.sex,bornOn:cat.bornOn,graduatedAt:now(),kind:'graduate'});f.legacy=f.legacy.slice(0,100);f.kittens=f.kittens.filter(c=>c.id!==catId);room.catPlan=null;message=`${cat.name}成年毕业，名字留在小屋家谱里，空出了一个小窝`;}
     else {room.catPlan=plan;message='已记录你的决定，等另一位主人确认';}
    }
    room.version=(room.version||0)+1;await doc(collections.rooms,room.id,tx).set({data:room});return {room,role,message};});return publicSnapshot(result.room,result.role,result.message,uid);
  }
  if(method==='giftCreate'){
   const catId=String(event.catId||''),token=nodeCrypto.randomBytes(18).toString('hex'),id='gift-'+nodeCrypto.createHash('sha256').update(token).digest('hex'),expiresAt=now()+7*86400000;
   const gift=await db.runTransaction(async tx=>{const {room,role}=await membership(uid,tx);membersOnly(role);const cat=room.home.family.kittens.find(c=>c.id===catId);if(!cat)throw fault('NOT_FOUND','只能赠送小屋里还未被领走的猫宝宝');await doc(collections.invites,id,tx).set({data:{kind:'gift',roomId:room.id,catId:cat.id,sex:cat.sex,sender:uid,expiresAt,used:false}});return {catName:cat.name,sex:cat.sex};});return {token,expiresAt,...gift};
  }
  if(method==='giftEntry'){
   const token=String(event.token||'');if(!/^[0-9a-f]{36}$/.test(token))throw fault('BAD_INPUT','赠猫卡片不正确');const id='gift-'+nodeCrypto.createHash('sha256').update(token).digest('hex'),gift=await readDoc(doc(collections.invites,id));if(!gift||gift.kind!=='gift'||gift.expiresAt<=now())throw fault('NOT_FOUND','这张赠猫卡已失效');if(gift.used){if(gift.claimedBy===uid)return {name:gift.catName||'小猫',sex:gift.sex,catId:gift.catId,claimed:true,hasOwnHome:true};throw fault('NOT_FOUND','这只猫宝宝已经有新家啦');}const room=await readDoc(doc(collections.rooms,gift.roomId)),cat=room&&room.home.family.kittens.find(c=>c.id===gift.catId);if(!cat)throw fault('NOT_FOUND','这只猫宝宝已经有新家啦');const user=await readDoc(doc(collections.users,uid));return {name:cat.name,sex:cat.sex,catId:cat.id,hasOwnHome:!!user&&!!user.roomId};
  }
  if(method==='giftClaim'){
   const token=String(event.token||'');if(!/^[0-9a-f]{36}$/.test(token))throw fault('BAD_INPUT','赠猫卡片不正确');const id='gift-'+nodeCrypto.createHash('sha256').update(token).digest('hex');
   const claimed=await db.runTransaction(async tx=>{const ref=doc(collections.invites,id,tx),gift=await readDoc(ref);if(!gift||gift.kind!=='gift'||gift.expiresAt<=now())throw fault('NOT_FOUND','这张赠猫卡已失效');
    if(gift.used){if(gift.claimedBy!==uid)throw fault('NOT_FOUND','这只猫宝宝已经有新家啦');const {room,role}=await membership(uid,tx);return {room,role,name:gift.catName};}
    const user=await readDoc(doc(collections.users,uid,tx));if(!user||!user.roomId)throw fault('BAD_INPUT','先创建自己的小屋，再来接小猫');const source=await readDoc(doc(collections.rooms,gift.roomId,tx));if(!source||source.members.me!==gift.sender&&source.members.you!==gift.sender)throw fault('NOT_FOUND','赠猫卡已失效');if(source.members.me===uid||source.members.you===uid)throw fault('FORBIDDEN','不能领走自己小屋的猫宝宝');
    source.home=normalizeHome(clone(source.home),today());const cat=source.home.family.kittens.find(c=>c.id===gift.catId);if(!cat)throw fault('NOT_FOUND','这只猫宝宝已经有新家啦');const target=await readDoc(doc(collections.rooms,user.roomId,tx));if(!target)throw fault('NO_ROOM','先创建自己的小屋，再来接小猫');membersOnly(roleIn(target,uid));target.home=normalizeHome(clone(target.home),today());const residents=target.home.family.parents.length+target.home.family.kittens.length;
    recipientRoomCheck(target,uid,cat);if(residents>=RESIDENT_LIMIT||target.home.family.kittens.length>=BABY_LIMIT)throw fault('CAT_FULL','你的小屋猫咪位置满啦');
    const incoming={...cat,sleeping:false,lastGrowthDay:today(),outfit:'none'};if(target.home.family.parents.length<2)target.home.family.parents.push(incoming);else target.home.family.kittens.push(incoming);target.catGuardians=target.catGuardians||{};target.catGuardians[incoming.id]=uid;
    source.home.family.kittens=source.home.family.kittens.filter(c=>c.id!==cat.id);refillFounderBabies(source);source.home.family.legacy=source.home.family.legacy||[];source.home.family.legacyTotal=(source.home.family.legacyTotal||0)+1;source.home.family.legacy.unshift({id:cat.id,name:cat.name,sex:cat.sex,bornOn:cat.bornOn,graduatedAt:now(),kind:'gift',to:'一位朋友'});source.home.family.legacy=source.home.family.legacy.slice(0,100);source.home.family.events.unshift({id:nodeCrypto.randomUUID(),text:`${cat.name}被朋友接进新家啦。`,at:new Date(now()).toISOString()});source.home.family.events=source.home.family.events.slice(0,10);target.home.family.events.unshift({id:nodeCrypto.randomUUID(),text:`${cat.name}收到了一份来自朋友的爱。`,at:new Date(now()).toISOString()});target.home.family.events=target.home.family.events.slice(0,10);
    gift.used=true;gift.claimedBy=uid;gift.catName=cat.name;gift.claimedAt=now();source.version=(source.version||0)+1;target.version=(target.version||0)+1;await ref.set({data:gift});await doc(collections.rooms,source.id,tx).set({data:source});await doc(collections.rooms,target.id,tx).set({data:target});return {room:target,role:roleIn(target,uid),name:cat.name};
   });return publicSnapshot(claimed.room,claimed.role,`欢迎 ${claimed.name} 来到你的小屋！`,uid);
  }
  if(method==='adoptCat'){
   const sourceId=String(event.sourceRoomId||''),sex=String(event.sex||''),catId=String(event.catId||''),requestId=String(event.requestId||'');if(requestId&&!/^[A-Za-z0-9-]{8,80}$/.test(requestId))throw fault('BAD_INPUT','领取编号不正确，请重试');if(!/^[0-9a-f-]{36}$/i.test(sourceId)||!['boy','girl'].includes(sex))throw fault('BAD_INPUT','请在访客小屋选一只公猫或母猫');
   const result=await db.runTransaction(async tx=>{
    const user=await readDoc(doc(collections.users,uid,tx))||{roomId:null};
    if(requestId&&(user.adoptionReceipts||[]).some(receipt=>receipt.id===requestId&&receipt.sourceId===sourceId&&receipt.sex===sex)){const {room,role}=await membership(uid,tx);return {room,role,name:'小猫'};}
    const source=await readDoc(doc(collections.rooms,sourceId,tx));if(!source)throw fault('NO_ROOM','这间小屋已关闭');
    if(source.members.me===uid||source.members.you===uid)throw fault('FORBIDDEN','主人不能从自己的小屋领取小猫');
    source.home=normalizeHome(clone(source.home),today());const cat=source.home.family.kittens.find(c=>c.sex===sex&&(!catId||c.id===catId));if(!cat)throw fault('NOT_FOUND','这只宝宝已被领走，请刷新后选择其他宝宝');
    const wallet=guestWallet(user,sourceId);
    if((wallet.helped||0)<3)throw fault('NOT_READY','在这间小屋成功喂猫或添奶累计 3 次，就可以领取一只宝宝');
    let target=user.roomId?await readDoc(doc(collections.rooms,user.roomId,tx)):null;if(user.roomId&&!target)throw fault('NO_ROOM','你的小屋已关闭，请重新进入');
    if(target&&target.id===source.id)throw fault('BAD_INPUT','不能把猫领到原来的小屋');
    if(!target)throw fault('BAD_INPUT','先创建自己的小屋，再回来领养猫宝宝；帮忙次数会保留');
    membersOnly(roleIn(target,uid));target.home=normalizeHome(clone(target.home),today());const residents=target.home.family.parents.length+target.home.family.kittens.length;
    recipientRoomCheck(target,uid,cat);
    if(residents>=RESIDENT_LIMIT||target.home.family.kittens.length>=BABY_LIMIT)throw fault('CAT_FULL','你的小屋猫咪位置满啦，先让成年猫毕业或送养');
    const incoming={...cat,sleeping:false,lastGrowthDay:today(),outfit:'none'};if(target.home.family.parents.length<2)target.home.family.parents.push(incoming);else target.home.family.kittens.push(incoming);
    target.catGuardians=target.catGuardians||{};target.catGuardians[incoming.id]=uid;
    source.home.family.kittens=source.home.family.kittens.filter(c=>c.id!==cat.id);refillFounderBabies(source);if(source.catPlan&&source.catPlan.catId===cat.id)source.catPlan=null;
    source.home.family.legacy=source.home.family.legacy||[];source.home.family.legacyTotal=(source.home.family.legacyTotal||0)+1;source.home.family.legacy.unshift({id:cat.id,name:cat.name,sex:cat.sex,bornOn:cat.bornOn,graduatedAt:now(),kind:'adopt',to:'一位访客'});source.home.family.legacy=source.home.family.legacy.slice(0,100);source.home.family.events.unshift({id:nodeCrypto.randomUUID(),text:`${cat.name}被新朋友接进小屋啦。`,at:new Date(now()).toISOString()});source.home.family.events=source.home.family.events.slice(0,10);
    target.home.family.events.unshift({id:nodeCrypto.randomUUID(),text:`${cat.name}从朋友的小屋来到这里。`,at:new Date(now()).toISOString()});target.home.family.events=target.home.family.events.slice(0,10);
    wallet.helped-=3;if(requestId)user.adoptionReceipts=[{id:requestId,sourceId,sex},...(user.adoptionReceipts||[])].slice(0,50);source.version=(source.version||0)+1;target.version=(target.version||0)+1;
    await doc(collections.users,uid,tx).set({data:user});await doc(collections.rooms,source.id,tx).set({data:source});await doc(collections.rooms,target.id,tx).set({data:target});return {room:target,role:roleIn(target,uid),name:cat.name};
   });return publicSnapshot(result.room,result.role,`欢迎 ${result.name} 来到你的小屋！你可以独自照顾它，也可以邀请另一位一起养`,uid);
  }
  if(method==='releaseCat'){
   const catId=String(event.catId||'');
   const result=await db.runTransaction(async tx=>{const {room,role,user}=await membership(uid,tx);membersOnly(role);room.home=normalizeHome(clone(room.home),today());
    if(!ownedCatIds(room,uid).includes(catId))throw fault('FORBIDDEN','只能结束你自己领养猫的抚养，不能删除对方的猫或创世猫');
    const family=room.home.family,cat=[...family.parents,...family.kittens].find(cat=>cat.id===catId);
    family.parents=family.parents.filter(cat=>cat.id!==catId);family.kittens=family.kittens.filter(cat=>cat.id!==catId);if(room.catGuardians)delete room.catGuardians[catId];
    family.pending=null;if(room.catPlan&&room.catPlan.catId===catId)room.catPlan=null;
    family.legacy=family.legacy||[];family.legacyTotal=(family.legacyTotal||0)+1;family.legacy.unshift({id:cat.id,name:cat.name,sex:cat.sex,bornOn:cat.bornOn,graduatedAt:now(),kind:'release'});family.legacy=family.legacy.slice(0,100);
    resetAdoptionCredits(user);room.version=(room.version||0)+1;syncPrimary(room.home);
    await doc(collections.rooms,room.id,tx).set({data:room});await doc(collections.users,uid,tx).set({data:user});return {room,role};
   });return publicSnapshot(result.room,result.role,'已结束这只猫的抚养；重新领养前，需要重新成功帮忙 3 次',uid);
  }
  if(method==='separateRoom'||method==='kickPartner'){
   const result=await db.runTransaction(async tx=>{const {room,role}=await membership(uid,tx);if(method==='kickPartner'&&role!=='me')throw fault('FORBIDDEN','只有发出邀请的人能请另一位搬出小屋');if(method==='separateRoom'&&role!=='you')throw fault('FORBIDDEN','受邀人可以自己解除共养，邀请人可使用移出对方');
    if(!room.members.you)throw fault('BAD_INPUT','你的小屋还没有配对');room.home=normalizeHome(clone(room.home),today());
    const invited=room.members.you,invitedUser=await readDoc(doc(collections.users,invited,tx));if(!invitedUser||invitedUser.roomId!==room.id)throw fault('ROOM_CHANGED','另一位的小屋状态已变化，请刷新后重试');
    const ids=ownedCatIds(room,invited),cats=[...room.home.family.parents,...room.home.family.kittens].filter(cat=>ids.includes(cat.id));
    const shared=room.home.family.kittens.filter(cat=>cat.generation>0&&!ids.includes(cat.id)&&!ownedCatIds(room,room.members.me).includes(cat.id));
    const creatorUser=await readDoc(doc(collections.users,room.members.me,tx));
    if(!creatorUser)throw fault('ROOM_CHANGED','创建人的小屋状态已变化，请刷新后重试');
    personalFish(creatorUser,room,room.members.me);personalFish(invitedUser,room,invited);
    const home=normalizeHome(clone(initialHome),today()),id=nodeCrypto.randomUUID();home.family.parents=cats.slice(0,2);home.family.kittens=cats.slice(2);home.family.events=[];home.family.bond=0;home.family.pending=null;home.family.feedingProgress=0;home.family.nestBuilt=false;home.me=room.home.you;home.coins=Math.floor(room.home.coins/2);home.visits.me=room.home.visits.you||0;
    const target={id,members:{me:invited,you:null},guests:[],home,items:[],receipts:[],version:1,createdAt:now(),imported:false,catGuardians:Object.fromEntries(ids.map(catId=>[catId,invited]))};
    room.catGuardians=room.catGuardians||{};for(const ownId of ownedCatIds(room,uid))room.catGuardians[ownId]=uid;
    room.home.coins-=home.coins;room.home.family.parents=room.home.family.parents.filter(cat=>!ids.includes(cat.id));room.home.family.kittens=room.home.family.kittens.filter(cat=>!ids.includes(cat.id)&&!shared.some(sharedCat=>sharedCat.id===cat.id));for(const catId of ids)delete room.catGuardians[catId];
    for(const cat of shared){const fosterId=nodeCrypto.randomUUID(),foster={kind:'foster',listed:true,id:fosterId,cat,guardians:[room.members.me,invited],founderRoomId:(await readDoc(doc(collections.invites,'mw-founder-pair-v1',tx))||{}).roomId||'',createdAt:now(),state:'foster',proposal:null};await fosterRef(fosterId,tx).set({data:foster});creatorUser.fosterIds=[...(creatorUser.fosterIds||[]),fosterId];invitedUser.fosterIds=[...(invitedUser.fosterIds||[]),fosterId];}
    room.home.family.pending=null;room.catPlan=null;room.home.together='';room.home.visits.you=0;delete room.home.checkins.you;room.home.adventure=resetAdventure(today());room.members.you=null;room.version=(room.version||0)+1;syncPrimary(room.home);syncPrimary(home);
    invitedUser.roomId=id;await doc(collections.rooms,room.id,tx).set({data:room});await doc(collections.rooms,id,tx).set({data:target});await doc(collections.users,invited,tx).set({data:invitedUser});await doc(collections.users,room.members.me,tx).set({data:creatorUser});return {room:role==='me'?room:target,role:'me',fosterCount:shared.length};
   });return publicSnapshot(result.room,result.role,result.fosterCount?`已解除共养：${result.fosterCount} 只共同宝宝住进创世屋寄养区，原先两人仍能照顾`:'已解除共养：各自领养的猫回到各自的小屋',uid);
  }
  if(method==='fosterList'){
   const user=await readDoc(doc(collections.users,uid)),mine=[],offers=[],myRoom=user&&user.roomId&&await readDoc(doc(collections.rooms,user.roomId)),housemate=myRoom&&(myRoom.members.me===uid?myRoom.members.you:myRoom.members.you===uid?myRoom.members.me:null);
   for(const id of user&&user.fosterIds||[]){const foster=await readDoc(fosterRef(id));if(foster&&foster.state==='foster'&&foster.guardians.includes(uid)){const item=fosterView(foster,uid);item.hasNewPartner=!!housemate&&!foster.guardians.includes(housemate);mine.push(item);}}
   for(const id of user&&user.fosterOffers||[]){const foster=await readDoc(fosterRef(id));if(foster&&foster.state==='foster'&&foster.proposal&&foster.proposal.recipient===uid)offers.push(fosterView(foster,uid));}
   const founder=await readDoc(doc(collections.invites,'mw-founder-pair-v1'));
   let publicCats=[],nextOffset=null;if(founder&&founder.roomId){const offset=Math.max(0,Math.min(10000,Number(event.offset)||0));const query=await db.collection(collections.invites).where({listed:true}).skip(offset).limit(20).get(),rows=query.data||[];publicCats=rows.filter(f=>f.founderRoomId===founder.roomId&&['foster','public'].includes(f.state)).map(f=>fosterView(f,uid)).filter(f=>!f.mine&&!f.offered);if(rows.length===20)nextOffset=offset+20;}
   return {mine,offers,publicCats,nextOffset};
  }
  if(method==='fosterCare'){
   const id=String(event.fosterId||''),action=String(event.action||'');if(!/^[0-9a-f-]{36}$/i.test(id)||!['feed','pet'].includes(action))throw fault('BAD_INPUT','请选择寄养小猫和照顾方式');
   const result=await db.runTransaction(async tx=>{const ref=fosterRef(id,tx),foster=await readDoc(ref);if(!foster||!['foster','public'].includes(foster.state))throw fault('NOT_FOUND','小猫已经离开寄养区啦');
    const founder=await readDoc(doc(collections.invites,'mw-founder-pair-v1',tx));if(!founder||foster.founderRoomId!==founder.roomId)throw fault('NOT_FOUND','创世屋寄养区暂时没有这只小猫');
    const user=await readDoc(doc(collections.users,uid,tx))||{roomId:null},room=user.roomId&&await readDoc(doc(collections.rooms,user.roomId,tx));if(room&&room.members.me!==uid&&room.members.you!==uid)throw fault('FORBIDDEN','只能用自己的小鱼干照顾');
    const fish=personalFish(user,room,uid);
    const fosterHome=normalizeHome({...clone(initialHome),coins:fish,family:{parents:[clone(foster.cat)],kittens:[],bond:0,feedingProgress:0,events:[]}},today());
    let applied;try{applied=applyAction(fosterHome,action,'guest',{catId:foster.cat.id,helperKey:nodeCrypto.createHash('sha256').update(uid).digest('hex')},today());}catch(error){throw fault('BAD_ACTION',error.message);}
    foster.cat=applied.home.family.parents[0];foster.version=(foster.version||0)+1;await ref.set({data:foster});
    user.fishBalance=applied.home.coins;await doc(collections.users,uid,tx).set({data:user});
    return {cat:fosterView(foster,uid).cat,fish:applied.home.coins,message:applied.message};
   });return result;
  }
  if(method==='fosterProposal'){
   const id=String(event.fosterId||''),kind=String(event.kind||''),side=String(event.side||'');if(!/^[0-9a-f-]{36}$/i.test(id)||!['keep','first','second','newPartner','public'].includes(kind)||kind==='newPartner'&&!['first','second'].includes(side))throw fault('BAD_INPUT','请选择小猫的新安排');
   return db.runTransaction(async tx=>{const ref=fosterRef(id,tx),foster=await readDoc(ref);if(!foster||foster.state!=='foster')throw fault('NOT_FOUND','小猫已经有新安排啦');
    if(!foster.guardians.includes(uid))throw fault('FORBIDDEN','只有原先两位抚养人可以商量小猫的去向');
    let recipient='';if(kind==='first')recipient=foster.guardians[0];if(kind==='second')recipient=foster.guardians[1];
    if(kind==='newPartner'){const parent=foster.guardians[side==='first'?0:1],u=await readDoc(doc(collections.users,parent,tx)),r=u&&u.roomId&&await readDoc(doc(collections.rooms,u.roomId,tx));recipient=r&&(r.members.me===parent?r.members.you:r.members.me);if(!recipient||foster.guardians.includes(recipient))throw fault('BAD_INPUT','这位原主人目前没有新的同住伴侣');}
    const old=foster.proposal,same=old&&old.kind===kind&&old.side===side&&old.recipient===recipient;
    if(old&&!same)await clearOffer(tx,foster);
    foster.proposal=same?old:{kind,side,recipient,approvals:{[uid]:true},accepted:false,at:now()};foster.proposal.approvals[uid]=true;
    if(kind==='newPartner'){const offerRef=doc(collections.users,recipient,tx),person=await readDoc(offerRef);if(!person)throw fault('ROOM_CHANGED','新伴侣暂时无法接手');person.fosterOffers=[...new Set([...(person.fosterOffers||[]),id])];await offerRef.set({data:person});}
    const approved=foster.guardians.every(person=>foster.proposal.approvals[person]);let message='已提出安排，等待另一位原主人确认';
    if(approved&&(kind!=='newPartner'||foster.proposal.accepted)){
     if(kind==='keep'){foster.proposal=null;message='继续共同照顾，小猫留在创世屋寄养区';}
     else if(kind==='public'){foster.state='public';foster.proposal=null;await finishFoster(tx,foster);message='双方都同意啦，小猫已开放领养';}
     else {await transferFoster(tx,foster,recipient);await clearOffer(tx,foster);foster.state='moved';foster.listed=false;foster.proposal=null;await finishFoster(tx,foster);message='小猫已经搬进新的小屋';}
    }else if(approved)message='原先两人已经同意，等待新伴侣接受';
    await ref.set({data:foster});return {message,state:foster.state};
   });
  }
  if(method==='fosterAccept'){
   const id=String(event.fosterId||'');if(!/^[0-9a-f-]{36}$/i.test(id))throw fault('BAD_INPUT','小猫不在寄养区');
   return db.runTransaction(async tx=>{const ref=fosterRef(id,tx),foster=await readDoc(ref),proposal=foster&&foster.proposal;if(!foster||foster.state!=='foster'||!proposal||proposal.kind!=='newPartner'||proposal.recipient!==uid)throw fault('FORBIDDEN','这次接手邀请不是给你的');
    if(!foster.guardians.every(person=>proposal.approvals[person]))throw fault('NOT_READY','等原先两位主人都同意后才能接手');
    await transferFoster(tx,foster,uid);await clearOffer(tx,foster);foster.state='moved';foster.listed=false;foster.proposal=null;await finishFoster(tx,foster);await ref.set({data:foster});return {message:'你接手了这只小猫，以后一起照顾它吧'};
   });
  }
  if(method==='fosterDecline'){
   const id=String(event.fosterId||'');if(!/^[0-9a-f-]{36}$/i.test(id))throw fault('BAD_INPUT','小猫不在寄养区');
   return db.runTransaction(async tx=>{const ref=fosterRef(id,tx),foster=await readDoc(ref);if(!foster||foster.state!=='foster'||!foster.proposal||foster.proposal.kind!=='newPartner'||foster.proposal.recipient!==uid)throw fault('FORBIDDEN','这次邀请不是给你的');await clearOffer(tx,foster);foster.proposal=null;await ref.set({data:foster});return {message:'已婉拒接手，小猫继续在创世屋寄养'};});
  }
  if(method==='fosterAdopt'){
   const id=String(event.fosterId||'');if(!/^[0-9a-f-]{36}$/i.test(id))throw fault('BAD_INPUT','请选择开放领养的小猫');
   const result=await db.runTransaction(async tx=>{const ref=fosterRef(id,tx),foster=await readDoc(ref);if(!foster||foster.state!=='public')throw fault('NOT_FOUND','这只猫暂时不能领养');if(foster.guardians.includes(uid))throw fault('FORBIDDEN','原主人想重新接回小猫，请先商量归属');
    const founder=await readDoc(doc(collections.invites,'mw-founder-pair-v1',tx)),user=await readDoc(doc(collections.users,uid,tx));if(!founder||foster.founderRoomId!==founder.roomId||!user||!user.roomId)throw fault('BAD_INPUT','请先创建自己的小屋');
    const wallet=guestWallet(user,founder.roomId);if((wallet.helped||0)<3)throw fault('NOT_READY','先在创世猫屋照顾 3 次，才能领养寄养区开放的小猫');
    await transferFoster(tx,foster,uid);wallet.helped-=3;foster.state='moved';foster.listed=false;await ref.set({data:foster});await doc(collections.users,uid,tx).set({data:user});return {message:'小猫有了新家，欢迎它来到你的小屋'};
   });return result;
  }
  if(method==='dailyContent'){
   const day=today();
   const claimed=await db.runTransaction(async tx=>{
    const {room,role}=await membership(uid,tx);membersOnly(role);
    if(room.daily&&room.daily.day===day&&room.daily.status==='ready')return {room,role};
    if(room.home.adventure.duet.day===day&&Object.keys(room.home.adventure.duet.answers||{}).length){room.daily={...fallbackContent(day),status:'ready'};await doc(collections.rooms,room.id,tx).set({data:room});return {room,role};}
    if(room.daily&&room.daily.day===day&&room.daily.status==='pending'&&now()-room.daily.startedAt<25000)return {waiting:true};
    const previousTitles=room.daily&&room.daily.status==='ready'?room.daily.questions.map(q=>q.title):[];
    const token=nodeCrypto.randomUUID();room.daily={day,status:'pending',token,startedAt:now()};await doc(collections.rooms,room.id,tx).set({data:room});return {token,previousTitles};
   });
   if(claimed.room)return publicSnapshot(claimed.room,claimed.role);
   if(claimed.waiting)return {waiting:true};
   let daily=fallbackContent(day);const apiKey=getApiKey(),provider=getProvider();
   try{
    if(provider==='hunyuan'&&getCloudAI())daily=await requestCloudDaily({ai:getCloudAI(),day,previousTitles:claimed.previousTitles});
    else if(provider==='openai'&&apiKey)daily=await requestDaily({apiKey,day,previousTitles:claimed.previousTitles});
   }catch(error){console.error('MW_DAILY_FALLBACK',{code:error.code||'AI_UNAVAILABLE'});}
   const saved=await db.runTransaction(async tx=>{
    const {room,role}=await membership(uid,tx);membersOnly(role);
    if(room.daily&&room.daily.day===day&&room.daily.status==='pending'&&room.daily.token===claimed.token){
     if(room.home.adventure.duet.day===day&&Object.keys(room.home.adventure.duet.answers||{}).length)daily=fallbackContent(day);
     room.daily={...daily,status:'ready'};room.home=normalizeHome(clone(room.home),day);room.home.adventure.dailyPhrases={day,messages:daily.messages};room.version++;await doc(collections.rooms,room.id,tx).set({data:room});
    }
    return {room,role};
   });return publicSnapshot(saved.room,saved.role);
  }
  if(method==='action'){
   if(!allowedActions.has(event.action))throw fault('BAD_INPUT','没有这个小屋操作');const payload=event.payload&&typeof event.payload==='object'&&!Array.isArray(event.payload)?{...event.payload}:{};delete payload.nurseryPetCredit;
   const result=await mutate(uid,event,(room,role,wallet,walletUser)=>{
    if((role==='guest'&&event.action==='feed')||event.action==='family_help'){const daily=room.guestFeeds&&room.guestFeeds.day===today()?room.guestFeeds:{day:today(),counts:{}};room.guestFeeds=daily;}
    if(event.action==='duet_submit'&&(!room.daily||room.daily.day!==today()||room.daily.status!=='ready')){room.daily={...fallbackContent(today()),status:'ready'};room.home.adventure.dailyPhrases={day:today(),messages:room.daily.messages};}
    const changed=[];
    if(event.action==='settings'){
     for(const key of ['roomName','me','you','catName'])if(payload[key]!==undefined&&String(payload[key]).trim()!==(room.home[key]||(key==='roomName'?'两个人的温馨小屋':'')))changed.push(key==='catName'?'cat-boy':key);
     if(payload.girlName!==undefined&&room.home.family.parents[1]&&String(payload.girlName).trim()!==room.home.family.parents[1].name)changed.push('cat-girl');
    }
    if(event.action==='cat_rename'){
     const cat=[...room.home.family.parents,...room.home.family.kittens].find(c=>c.id===payload.catId);
     if(cat&&String(payload.name||'').trim()!==cat.name)changed.push(cat.id);
    }
    const renameAt=room.renameAt||{};
    if(changed.some(key=>now()-(renameAt[key]||0)<3*86400000))throw fault('RENAME_LIMIT','这个名字改过后要等 3 天，才可以再次修改');
    let petUsage;if(event.action==='pet'){petUsage=walletUser.nurseryPetUsage&&walletUser.nurseryPetUsage.day===today()?walletUser.nurseryPetUsage:{day:today(),count:0};payload.nurseryPetCredit=petUsage.count<PET_NURSERY_DAILY_LIMIT;}
    const beforeFish=room.home.coins;payload.helperKey=nodeCrypto.createHash('sha256').update(uid).digest('hex');
    let applied;try{applied=applyAction(room.home,event.action,role,payload,today());}catch(error){if(error.constructor===Error&&!error.code)throw fault('BAD_ACTION',error.message);throw error;}room.home=applied.home;if(event.action==='pet'&&payload.nurseryPetCredit){petUsage.count++;walletUser.nurseryPetUsage=petUsage;}
    if(event.action==='catch'||event.action==='game'){const reward=gameReward(walletUser,today(),event.action,Number(payload.score)||0,wallet?Math.max(0,200-beforeFish):Infinity);if(wallet)wallet[event.action==='catch'?'catchPlays':'gamePlays']++;room.home.coins=beforeFish+reward;applied.message=(event.action==='catch'?'接鱼完成':'配对完成')+(reward?`，你的小鱼干 +${reward}`:(process.env.MW_REWARDED_AD_UNIT_ID?'，今天的本项奖励次数或小游戏鱼干额度已用完；仍可继续玩':'，这局成绩已记下，本局没有额外鱼干奖励'));}
    if((role==='guest'&&event.action==='feed')||event.action==='family_help'){
     room.guestFeeds.counts[uid]=(room.guestFeeds.counts[uid]||0)+1;
     if(role==='guest'){room.helperIds=room.helperIds||[];if(!room.helperIds.includes(uid)&&room.helperIds.length<500){room.helperIds.push(uid);room.helperTotal=(room.helperTotal||0)+1;}wallet.helped=(wallet.helped||0)+1;}

    }
    if(event.action==='hug'){const r=room.home.adventure.reactions[0];if(r)memoryNotice(room,role,{id:r.id,kind:'heart',title:r.text},'heart');}
    if(changed.length){for(const key of changed)renameAt[key]=now();room.renameAt=renameAt;}
    return applied.message;
   });return publicSnapshot(result.room,result.role,result.message,uid);
  }
  if(method==='readMemoryNotices'){
   const ids=new Set(Array.isArray(event.ids)?event.ids.slice(0,60):[]);
   const result=await db.runTransaction(async tx=>{const {room,role}=await membership(uid,tx,event.visitRoom);membersOnly(role);let changed=false;for(const n of room.memoryNotices||[])if(n.to===uid&&!n.read&&ids.has(n.id)){n.read=true;changed=true;}if(changed){room.version=(room.version||0)+1;await doc(collections.rooms,room.id,tx).set({data:room});}return {room,role};});return publicSnapshot(result.room,result.role,'',uid);
  }
  if(method==='saveMemory'){
   const p=event.payload||{},title=cleanText(p.title,80,true),body=cleanText(p.body,2000),kind=p.kind;
   if(!['photo','note','wish'].includes(kind))throw fault('BAD_INPUT','请选择照片、留言或愿望');
   const {room,role}=await membership(uid,db,event.visitRoom);membersOnly(role);let uploaded=null,oldFile=null,committed=false;
   if(p.imageBase64){if(kind!=='photo')throw fault('BAD_IMAGE','照片只放在相册里');const {bytes,ext}=imageBytes(p.imageBase64);const r=await storage.uploadFile({cloudPath:`mw-private/${room.id}/${nodeCrypto.randomUUID()}.${ext}`,fileContent:bytes});uploaded=r.fileID;}
   try{const result=await mutate(uid,event,(current,role)=>{if(current.id!==room.id)throw fault('ROOM_CHANGED','小屋已改变，请重新选择照片');const existing=p.id&&current.items.find(i=>i.id===p.id);if(p.id&&!existing)throw fault('NOT_FOUND','这条收藏已经移出了小屋');if(existing&&existing.kind!==kind)throw fault('BAD_INPUT','收藏类型不能更换');if(!existing&&current.items.length>=100)throw fault('MEMORY_LIMIT','已经有 100 份收藏啦，整理一些后再放进来');if(kind==='photo'&&!existing&&!uploaded)throw fault('BAD_IMAGE','先选一张照片吧');if(existing){existing.title=title;existing.body=body;if(uploaded){oldFile=existing.media;existing.media=uploaded;existing.needsPhoto=false;}}else current.items.unshift({id:nodeCrypto.randomUUID(),kind,title,body,media:uploaded,author:role,created_at:new Date(now()).toISOString(),done:0});memoryNotice(current,role,existing||current.items[0],existing?'updated':'created');return '美好已经放进小屋啦';});committed=true;if(result.duplicate&&uploaded)await storage.deleteFile({fileList:[uploaded]});else if(oldFile)await storage.deleteFile({fileList:[oldFile]}).catch(()=>{});return publicSnapshot(result.room,result.role,result.message);}catch(e){if(uploaded&&!committed)await storage.deleteFile({fileList:[uploaded]}).catch(()=>{});throw e;}
  }
  if(method==='editMemory'){
   const p=event.payload||{};let deletedFile=null;const result=await mutate(uid,event,(current,role)=>{const item=current.items.find(i=>i.id===p.id);if(!item)throw fault('NOT_FOUND','这条收藏已经移出了小屋');if(p.remove===true){memoryNotice(current,role,item,'removed');deletedFile=item.media;current.items=current.items.filter(i=>i.id!==p.id);return '这份收藏已移出';}if(item.kind!=='wish')throw fault('BAD_INPUT','只有小愿望可以标记完成');const done=p.done?1:0;if(item.done!==done)memoryNotice(current,role,item,done?'completed':'reopened');item.done=done;return item.done?'小愿望实现啦 ♡':'愿望继续放在心上';});if(deletedFile)await storage.deleteFile({fileList:[deletedFile]}).catch(()=>{});return publicSnapshot(result.room,result.role,result.message);
  }
  if(method==='importBackup'){
   if(typeof event.backup!=='string'||event.backup.length>700000)throw fault('BAD_BACKUP','请选择 700KB 以内的文字备份');const imported=parseBackup(event.backup);
   const result=await mutate(uid,event,(room,role)=>{if(role!=='me')throw fault('FORBIDDEN','旧存档由小屋创建者导入');if(room.imported||room.items.length||room.home.love||room.home.family.kittens.length)throw fault('NOT_EMPTY','只能导入一次到还没开始养猫的新小屋');room.home=imported.home;room.items=imported.items;room.imported=true;return `进度和收藏文字已导入${imported.missingPhotos?'，原照片需要重新选图补传':''}`;});return publicSnapshot(result.room,result.role,result.message);
  }
  if(method==='adTicket'){
   if(!process.env.MW_REWARDED_AD_UNIT_ID)throw fault('AD_UNAVAILABLE','广告还没开通，普通照顾仍可成长，小游戏也能赚鱼干');
   const ticket=nodeCrypto.randomUUID(),stamp=now(),day=today(),purpose=['growth','nursery'].includes(event.purpose)?event.purpose:'fish',catId=String(event.catId||'');
   await db.runTransaction(async tx=>{const {room,role}=await membership(uid,tx,event.visitRoom);
    room.home=normalizeHome(clone(room.home),day);if(purpose==='growth')checkGrowthCat(room,role,catId,day);if(purpose==='nursery'){checkNurseryReward(room);const reserved=Object.entries(room.adPending||{}).filter(([viewer,pending])=>viewer!==uid&&pending.purpose==='nursery'&&pending.day===day&&stamp-pending.at<300000).length;if((room.home.family.milkAdsCount||0)+reserved>=3)throw fault('AD_LIMIT','育儿奶领取名额正在使用，请稍后再来');}
    const usage=room.adUsage&&room.adUsage.day===day?room.adUsage:{day,users:{}};adQuota(usage,uid,purpose);
    if(purpose==='fish'){const person=await readDoc(doc(collections.users,uid,tx));if(person&&person.fishAdUsage&&person.fishAdUsage.day===day&&person.fishAdUsage.count>=3)throw fault('AD_LIMIT','今天的鱼干广告奖励已经领满啦，换个小屋也不能重复领取');}
    room.adUsage=usage;room.adPending=room.adPending||{};room.adPending[uid]={ticket,at:stamp,day,purpose,catId:purpose==='growth'?catId:''};await doc(collections.rooms,room.id,tx).set({data:room});
   });return {ticket,reward:purpose==='growth'?30:purpose==='nursery'?1:AD_REWARD,purpose};
  }
  if(method==='claimAdReward'){
   if(!process.env.MW_REWARDED_AD_UNIT_ID)throw fault('AD_UNAVAILABLE','广告还没开通，普通照顾仍可成长，小游戏也能赚鱼干');
   const token=String(event.ticket||''),stamp=now(),day=today();if(!/^[0-9a-f-]{36}$/i.test(token))throw fault('BAD_INPUT','广告奖励凭证不正确');
   const result=await db.runTransaction(async tx=>{const {room,role}=await membership(uid,tx,event.visitRoom);const pending=room.adPending&&room.adPending[uid],usage=room.adUsage&&room.adUsage.day===day?room.adUsage:{day,users:{}};
    if(!pending||pending.ticket!==token||pending.day!==day||stamp-pending.at<5000||stamp-pending.at>300000)throw fault('AD_INVALID','这次广告尚未完成或奖励已领取');
    const purpose=pending.purpose||'fish',quota=adQuota(usage,uid,purpose);
    room.home=normalizeHome(clone(room.home),day);let message='';
    if(pending.purpose==='growth'){
     const cat=checkGrowthCat(room,role,pending.catId,day),gain=Math.min(30,ADULT_GROWTH-cat.growth);cat.boostDay=day;cat.boostCount=(cat.boostCount||0)+1;cat.growth+=gain;cat.energy=Math.max(0,cat.energy-5);syncPrimary(room.home);message=`${cat.name}成长 +${gain}，今天已加速 ${cat.boostCount}/3 次${cat.growth>=ADULT_GROWTH?'，已经长成成年猫啦！':''}`;
    }else if(purpose==='nursery'){checkNurseryReward(room);const family=room.home.family;family.nurseryMilk=(family.nurseryMilk||0)+1;family.milkAdsCount=(family.milkAdsCount||0)+1;message='育儿奶 +1，攒满 12 次照顾后再添奶，就能迎接额外一窝';
    }else{const person=await personalUser(uid,tx,room),used=person.fishAdUsage&&person.fishAdUsage.day===day?person.fishAdUsage.count:0;if(used>=3)throw fault('AD_LIMIT','今天的鱼干广告奖励已经领满啦，换个小屋也不能重复领取');const awarded=AD_REWARD;person.fishBalance+=awarded;person.fishAdUsage={day,count:used+1};await doc(collections.users,uid,tx).set({data:person});message=`小鱼干 +${awarded}，快去喂猫吧 🐟`;}
    quota[purpose]=(quota[purpose]||0)+1;usage.byPurpose=usage.byPurpose||{};usage.byPurpose[uid]=quota;usage.users[uid]=(usage.users[uid]||0)+1;room.adUsage=usage;delete room.adPending[uid];room.version=(room.version||0)+1;await doc(collections.rooms,room.id,tx).set({data:room});return {room,role,message};
   });return publicSnapshot(result.room,result.role,result.message,uid);
  }
  if(method==='chatStatus'){await membership(uid,db,event.visitRoom);const provider=getProvider(),ready=provider==='hunyuan'?!!getCloudAI():!!getApiKey();return {ready,model:ready?(provider==='hunyuan'?CLOUD_MODEL:MODEL):null,viewerKey:nodeCrypto.createHash('sha256').update(uid).digest('hex').slice(0,24),reason:ready?'':provider==='hunyuan'?'云函数 AI 能力尚未就绪':'模型密钥尚未配置到云函数'};}
  if(method==='chatSend'){
   const {room}=await membership(uid,db,event.visitRoom),apiKey=getApiKey(),provider=getProvider();
   if(provider==='openai'&&!apiKey)throw fault('AI_UNAVAILABLE','AI 密钥尚未配置到云函数');
   if(provider==='hunyuan'&&!getCloudAI())throw fault('AI_UNAVAILABLE','云函数 AI 能力尚未就绪');
   const message=cleanText(event.message,600,true),personality=event.personality==='sassy'?'sassy':'soft';
   const history=Array.isArray(event.history)?event.history:[];
   if(history.length>8||history.some(item=>!item||!['user','assistant'].includes(item.role)||typeof item.text!=='string'||item.text.length>800))throw fault('BAD_INPUT','聊天记录太长了，请重新打开聊天页');
   const cat=[...room.home.family.parents,...room.home.family.kittens].find(item=>item.id===event.catId);
   if(!cat)throw fault('BAD_INPUT','先选一只要聊天的小猫');
   const stamp=now(),today=dayKey(new Date(stamp));
   const talkingCat=await db.runTransaction(async tx=>{
    const {room:current,role}=await membership(uid,tx,event.visitRoom);
    if(current.id!==room.id)throw fault('ROOM_CHANGED','小屋已改变，请重新打开聊天页');
    current.home=normalizeHome(clone(current.home),today);
    const currentCat=[...current.home.family.parents,...current.home.family.kittens].find(item=>item.id===cat.id);
    if(!currentCat)throw fault('BAD_INPUT','这只小猫已经不在小屋里');
    if(currentCat.hunger<CHAT_MIN_HUNGER)throw fault('CAT_HUNGRY',`${currentCat.name}饿得闹脾气啦，先喂一口再聊天吧`);
    const usage=current.chatUsage&&current.chatUsage.day===today?current.chatUsage:{day:today,users:{}};
    const entry=usage.users[uid]||{windowStart:stamp,windowCount:0};
    if(stamp-entry.windowStart>=60000){entry.windowStart=stamp;entry.windowCount=0;}
    if(entry.windowCount>=4)throw fault('AI_LIMIT','消息发得太快啦，请一分钟后再试');
    entry.windowCount++;usage.users[uid]=entry;current.chatUsage=usage;
    await doc(collections.rooms,current.id,tx).set({data:current});return clone(currentCat);
   });
   const options={name:talkingCat.name,sex:talkingCat.sex,personality,profile:catPersona(talkingCat,today),message,history};
   const reply=provider==='hunyuan'?await requestCloudAI({...options,ai:getCloudAI()}):await requestAI({...options,apiKey});
   const updated=await db.runTransaction(async tx=>{const {room:current}=await membership(uid,tx,event.visitRoom);current.home=normalizeHome(clone(current.home),today);const currentCat=[...current.home.family.parents,...current.home.family.kittens].find(item=>item.id===cat.id);if(currentCat){const before=currentCat.hunger;currentCat.hunger=Math.max(0,before-CHAT_HUNGER_COST);if(before>=CHAT_MIN_HUNGER&&currentCat.hunger<CHAT_MIN_HUNGER)currentCat.mood=Math.max(20,currentCat.mood-8);syncPrimary(current.home);}current.version=(current.version||0)+1;await doc(collections.rooms,current.id,tx).set({data:current});const person=await personalUser(uid,tx,current);return {hunger:currentCat&&currentCat.hunger,coins:person.fishBalance};});
   return {reply,catId:cat.id,hunger:updated.hunger,coins:updated.coins,serverNow:now()};
  }
  if(method==='leaveRoom'||method==='deleteRoom'){
   const result=await db.runTransaction(async tx=>{const {room,role,user}=await membership(uid,tx);if(method==='leaveRoom'){if(role==='me')throw fault('FORBIDDEN','创建者请使用关闭小屋');if(role==='you')throw fault('FORBIDDEN','要离开共养小屋，请使用解除共养并带走自己的猫');if(role==='guest')room.guests=(room.guests||[]).filter(id=>id!==uid);else room.members.you=null;room.version++;await doc(collections.rooms,room.id,tx).set({data:room});personalFish(user,room,uid);await doc(collections.users,uid,tx).set({data:{...user,roomId:null}});return {files:[]};}if(role!=='me')throw fault('FORBIDDEN','只有创建者可以关闭小屋');for(const member of [...Object.values(room.members),...(room.guests||[])].filter(Boolean)){const u=await readDoc(doc(collections.users,member,tx));if(u&&u.roomId===room.id){personalFish(u,room,member);await doc(collections.users,member,tx).set({data:{...u,roomId:null}});}}for(const digest of [room.inviteDigest,room.guestInviteDigest].filter(Boolean)){const i=await readDoc(doc(collections.invites,digest,tx));if(i)await doc(collections.invites,digest,tx).remove();}const founderRef=doc(collections.invites,'mw-founder-pair-v1',tx),founder=await readDoc(founderRef);if(founder&&founder.roomId===room.id)await founderRef.remove();await doc(collections.rooms,room.id,tx).remove();return {files:room.items.filter(i=>i.media).map(i=>i.media)};});for(let i=0;i<result.files.length;i+=50)await storage.deleteFile({fileList:result.files.slice(i,i+50)}).catch(()=>{});return {roomId:null,role:null,paired:false};
  }
  throw fault('NOT_FOUND','没有这个小屋功能');
 }
 return handle;
}
module.exports={createHandler,readDoc,imageBytes,collections};
