const {PET_NURSERY_DAILY_LIMIT}=require('./rules/nursery-policy');
const {gameReward,gameRewardState,GAME_FISH_DAILY_LIMIT}=require('./rules/economy');
const {getApp}=require('./runtime');
const config=require('../config');
const {initialHome,applyAction,dayKey}=require('./rules/home-state');
const {normalizeHome,visibleHome}=require('./rules/gameplay');
const {parseBackup}=require('./rules/backup');
const {structuredClone,crypto}=require('./platform');
const DEMO_KEY='wenxin-game-demo-v1';
function requestId(){return crypto.randomUUID();}
function visitRoom(){return tt.getStorageSync('mw-visit-room')||'';}
function demoState(){const saved=tt.getStorageSync(DEMO_KEY);if(saved&&saved.home)return saved;const day=dayKey(),home=normalizeHome(structuredClone(initialHome),day),{makeCat}=require('./rules/cat-family');for(const cat of home.family.parents)cat.growth=800;home.family.kittens=[{...makeCat('demo-baby-boy','小团子','boy',day,1),breedId:'british-blue'},{...makeCat('demo-baby-girl','小奶盖','girl',day,1),breedId:'ragdoll'}];return {home,items:[],version:0,imported:false};}
function demoSnapshot(state,message=''){const role=tt.getStorageSync('mw-demo-role')==='you'?'you':'me';return {nurseryPetRemaining:Math.max(0,PET_NURSERY_DAILY_LIMIT-(state.nurseryPetUsage&&state.nurseryPetUsage.day===dayKey()?state.nurseryPetUsage.count:0)),gameRewards:{...gameRewardState(state,dayKey()),limit:GAME_FISH_DAILY_LIMIT},home:visibleHome(normalizeHome(structuredClone(state.home),dayKey()),role),items:state.items.map(i=>({...i,mediaURL:i.media||'',needsPhoto:i.kind==='photo'&&!i.media})),daily:require('./rules/daily-content').fallbackContent(dayKey()),version:state.version,role,paired:true,owner:role==='me',roomId:'local-demo',demo:true,serverNow:Date.now(),message};}
async function local(method,event){
 const state=demoState(),role=tt.getStorageSync('mw-demo-role')==='you'?'you':'me';let message='';
 if(['session','getHome','createRoom','nurseryRoom'].includes(method))return demoSnapshot(state);
 if(method==='action'){const payload={...(event.payload||{})};delete payload.nurseryPetCredit;const petUsage=state.nurseryPetUsage&&state.nurseryPetUsage.day===dayKey()?state.nurseryPetUsage:{day:dayKey(),count:0};if(event.action==='pet')payload.nurseryPetCredit=petUsage.count<PET_NURSERY_DAILY_LIMIT;const before=state.home.coins,r=applyAction(state.home,event.action,role,payload);state.home=r.home;if(event.action==='pet'&&payload.nurseryPetCredit){petUsage.count++;state.nurseryPetUsage=petUsage;}message=r.message;if(['catch','game'].includes(event.action)){const reward=gameReward(state,dayKey(),event.action,Number(event.payload&&event.payload.score)||0);state.home.coins=before+reward;message=reward?'小游戏完成，小鱼干 +'+reward:'这局成绩已记下，本局没有额外鱼干奖励';}}
 else if(method==='saveMemory'){const p=event.payload||{};if(!['photo','note','wish'].includes(p.kind)||!p.title||p.title.length>80||(p.body||'').length>2000)throw Error('检查一下标题和正文吧');if(p.id){const item=state.items.find(i=>i.id===p.id);if(!item)throw Error('这条收藏已经不在了');item.title=p.title;item.body=p.body||'';if(p.localImage)item.media=p.localImage;}else{if(state.items.length>=100)throw Error('已经有 100 份收藏啦');if(p.kind==='photo'&&!p.localImage)throw Error('先选一张照片吧');state.items.unshift({id:requestId(),kind:p.kind,title:p.title,body:p.body||'',author:role,media:p.localImage||null,created_at:new Date().toISOString(),done:0});}message='美好已经放进小屋啦';}
 else if(method==='editMemory'){const p=event.payload||{},item=state.items.find(i=>i.id===p.id);if(!item)throw Error('这条收藏已经不在了');if(p.remove)state.items=state.items.filter(i=>i.id!==p.id);else item.done=p.done?1:0;message=p.remove?'这份收藏已移出':p.done?'小愿望实现啦 ♡':'愿望继续放在心上';}
 else if(method==='importBackup'){if(state.imported||state.home.love||state.items.length)throw Error('请导入到尚未开始养猫的新小屋');const imported=parseBackup(event.backup);state.home=imported.home;state.items=imported.items;state.imported=true;message=imported.missingPhotos?'进度已导入，原照片需要补传':'旧进度已导入';}
 else if(method==='chatStatus')return {ready:false,reason:'模型服务尚未连接'};
 else if(method==='chatSend')throw Error('AI 尚未连接，接通后小猫才能真正回复');
 else if(method==='deleteRoom'){tt.removeStorageSync(DEMO_KEY);return {roomId:null};}
 else throw Error('本机体验暂不支持跨手机操作，连接云开发后可用');
 state.version++;tt.setStorageSync(DEMO_KEY,state);return demoSnapshot(state,message);
}
async function call(method,extra={}){
 const event={method,...extra},startedSnapshot=getApp().globalData.snapshot;
 if(['getHome','nurseryRoom','action','chatStatus','chatSend','adTicket','claimAdReward'].includes(method)&&visitRoom())event.visitRoom=visitRoom();
 let result;
 if(!config.cloudEnv)result=await local(method,event);
 else{
  const r={result:await require('./transport').call(event)};
  const response=r.result;if(!response||!response.ok){const error=response&&response.error;throw Object.assign(Error(error&&error.message||'小屋暂时没有保存成功'),{code:error&&error.code||'CLOUD_FAILED'});}result=response.data;
 }
 if(result&&result.home){const app=getApp(),previous=app.globalData.snapshot;if(!(method==='getHome'&&previous&&previous!==startedSnapshot&&previous.roomId!==result.roomId)&&(!previous||previous.roomId!==result.roomId||result.version>=previous.version))app.globalData.snapshot=result;app.globalData.serverOffset=(result.serverNow||Date.now())-Date.now();}
 if(result&&Number.isFinite(result.serverNow))getApp().globalData.serverOffset=result.serverNow-Date.now();
 return result;
}
async function enterFounder(){const entry=await call('founderEntry');return enterVisit(entry.roomId);}
async function getHome(options={}){
 const app=getApp();if(app.globalData.visitRoom)return enterVisit(app.globalData.visitRoom);
 const snapshot=app.globalData.snapshot,token=options.conditional&&snapshot&&(!visitRoom()||visitRoom()===snapshot.roomId)?snapshot.syncToken:'';try{return await call('getHome',token?{syncToken:token}:{});}catch(error){if(error.code==='NO_ROOM'&&!isLocal())return enterFounder();throw error;}
}
function isLocal(){return !config.cloudEnv;}
async function enterVisit(roomId){const s=await call('visitRoom',{roomId});if(s.role==='guest')tt.setStorageSync('mw-visit-room',roomId);else tt.removeStorageSync('mw-visit-room');getApp().globalData.visitRoom='';getApp().globalData.snapshot=s;return s;}
function leaveVisit(){tt.removeStorageSync('mw-visit-room');getApp().globalData.visitRoom='';getApp().globalData.snapshot=null;}
module.exports={call,requestId,isDemo:()=>!config.cloudEnv,getHome,enterFounder,action:(action,payload,id)=>call('action',{action,payload,requestId:id||requestId()}),enterVisit,leaveVisit,visitRoom,demoRole:role=>tt.setStorageSync('mw-demo-role',role),now:()=>Date.now()+(getApp().globalData.serverOffset||0)};
