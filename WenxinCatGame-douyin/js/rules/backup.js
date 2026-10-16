const {MAX_GROWTH,migrateGrowth}=require('./growth-policy');
const {BABY_LIMIT}=require('./nursery-policy');
const {breeds,legacyCoats}=require('./cat-breeds');
const {initialHome,dayKey}=require('./home-state');
const {normalizeHome}=require('./gameplay');
const {initialFamily}=require('./cat-family');
const clone=x=>JSON.parse(JSON.stringify(x));
function text(value,max=16,fallback=''){if(value===undefined)return fallback;if(typeof value!=='string'||value.length>max)throw Error('备份中的文字格式不正确');return value.trim();}
function number(value,min,max,fallback=0){if(value===undefined)return fallback;if(!Number.isFinite(value)||value<min||value>max)throw Error('备份中的数值超出范围');return value;}
function date(value,fallback=''){const v=text(value,10,fallback);if(v&&(!/^\d{4}-\d{2}-\d{2}$/.test(v)||Number.isNaN(Date.parse(v))||new Date(v).toISOString().slice(0,10)!==v||v>dayKey()))throw Error('备份中的日期不正确');return v;}
function map(value,kind){const out={};if(!value||typeof value!=='object'||Array.isArray(value))return out;const keys=Object.keys(value);if(keys.length>1000)throw Error('备份中的历史记录过多');for(const key of keys){if(!/^[a-zA-Z0-9-]{1,32}$/.test(key))continue;out[key]=kind==='date'?date(value[key]):number(value[key],0,1000000);}return out;}
function cat(value,fallback,id,sex){if(!value||typeof value!=='object')return fallback;const c={...fallback};c.id=id||text(value.id,80);if(!c.id)throw Error('备份缺少小猫编号');c.name=text(value.name,16,c.name)||c.name;c.sex=sex||(value.sex==='girl'?'girl':'boy');c.color=c.sex==='girl'?'lilac':'cream';c.bornOn=date(value.bornOn,c.bornOn);c.lastGrowthDay=date(value.lastGrowthDay,c.bornOn);c.careDay=date(value.careDay,dayKey());for(const k of ['hunger','mood','energy'])c[k]=number(value[k],0,100,c[k]);c.growth=number(value.growth,0,MAX_GROWTH,c.growth);c.careXp=number(value.careXp,0,60,c.careXp);if([...breeds,...legacyCoats].some(b=>b.id===value.breedId))c.breedId=value.breedId;c.growthRevision=value.growthRevision;migrateGrowth(c);c.sleeping=value.sleeping===true;c.outfit=['none','bow','scarf','flower'].includes(value.outfit)?value.outfit:'none';return c;}
function parseBackup(input){
 const backup=typeof input==='string'?JSON.parse(input):input;
 if(!backup||!backup.home||typeof backup.home!=='object')throw Error('请选择 MW 小屋导出的 JSON 备份');
 const raw=backup.home,h=clone(initialHome),today=dayKey();
 h.roomName=text(raw.roomName,20,h.roomName)||h.roomName;
 for(const k of ['catName','me','you'])h[k]=text(raw[k],16,h[k])||h[k];h.together=date(raw.together);
 for(const k of ['hunger','mood','energy'])h[k]=number(raw[k],0,100,h[k]);h.love=number(raw.love,0,1000000);h.coins=number(raw.coins,0,1000000,h.coins);h.best=number(raw.best,0,1000);h.visits={me:number(raw.visits&&raw.visits.me,0,1000000),you:number(raw.visits&&raw.visits.you,0,1000000)};
 h.outfit=['none','bow','scarf','flower'].includes(raw.outfit)?raw.outfit:'none';h.theme=['cream','rose','sage'].includes(raw.theme)?raw.theme:'cream';h.owned=Array.from(new Set(['none','cream',...(Array.isArray(raw.owned)?raw.owned.filter(x=>['bow','scarf','flower','rose','sage'].includes(x)):[])]));h.sleeping=raw.sleeping===true;h.checkins=map(raw.checkins,'date');h.gameDays=map(raw.gameDays,'number');
 const family=initialFamily(h,today),f=raw.family;
 if(f&&Array.isArray(f.parents)&&f.parents.length===2){family.parents=f.parents.map((c,i)=>cat(c,family.parents[i],i?'cat-girl':'cat-boy',i?'girl':'boy'));family.parentNamesRevision=1;family.kittens=(Array.isArray(f.kittens)?f.kittens:[]).slice(0,BABY_LIMIT).map(c=>({...cat(c,family.parents[c.sex==='girl'?1:0]),generation:1}));if(new Set([...family.parents,...family.kittens].map(c=>c.id)).size!==2+family.kittens.length)throw Error('备份中的小猫编号重复');family.feedingProgress=number(f.feedingProgress,0,12,0);family.bond=number(f.bond,0,100);family.nestBuilt=f.nestBuilt===true;family.lastBirthAt=f.lastBirthAt&&Number.isFinite(Date.parse(f.lastBirthAt))?new Date(f.lastBirthAt).toISOString():null;family.events=(Array.isArray(f.events)?f.events:[]).slice(0,10).map(e=>({id:text(e.id,80),text:text(e.text,240),at:Number.isFinite(Date.parse(e.at))?new Date(e.at).toISOString():new Date().toISOString()}));
  if(f.pending){const p=f.pending;if(!Number.isFinite(Date.parse(p.dueAt)))throw Error('备份中的猫宝宝倒计时不正确');family.pending={id:text(p.id,80),dueAt:new Date(p.dueAt).toISOString(),warmth:number(p.warmth,0,10000),expected:number(p.expected,1,2),care:map(p.care,'number')};if(!Number.isInteger(family.pending.expected))throw Error('备份中的猫宝宝数量不正确');}
 }
 h.family=family;
 const normalized=normalizeHome(h,today),adventure=raw.adventure;
 if(adventure&&typeof adventure==='object'){
  const a=normalized.adventure;
  if(adventure.quest&&date(adventure.quest.day)===today){const q=adventure.quest;for(const name of ['care','play','hug'])a.quest[name]={me:!!(q[name]&&q[name].me),you:!!(q[name]&&q[name].you)};a.quest.claimed=q.claimed===true;}
  if(adventure.duet&&date(adventure.duet.day)===today){const d=adventure.duet;for(const role of ['me','you']){const answer=d.answers&&d.answers[role];if(Array.isArray(answer)&&answer.length===5&&answer.every(v=>Number.isInteger(v)&&v>=0&&v<=3))a.duet.answers[role]=answer;}a.duet.claimed=!!(d.claimed&&a.duet.answers.me&&a.duet.answers.you);}
  a.catchBest={me:number(adventure.catchBest&&adventure.catchBest.me,0,60),you:number(adventure.catchBest&&adventure.catchBest.you,0,60)};a.catchDays=map(adventure.catchDays,'number');
  a.reactions=(Array.isArray(adventure.reactions)?adventure.reactions:[]).slice(0,12).map(r=>({id:text(r.id,80),role:r.role==='you'?'you':'me',text:text(r.text,240),createdAt:Number.isFinite(Date.parse(r.createdAt))?new Date(r.createdAt).toISOString():new Date().toISOString()}));
 }
 const items=(Array.isArray(backup.items)?backup.items:[]).slice(0,100).filter(i=>i&&['photo','note','wish'].includes(i.kind)).map((i,n)=>({id:'import-'+n+'-'+Date.now(),kind:i.kind,title:text(i.title,80)||'一份旧日美好',body:text(i.body,2000),author:i.author==='you'?'you':'me',created_at:Number.isFinite(Date.parse(i.created_at))?new Date(i.created_at).toISOString():new Date().toISOString(),done:i.done?1:0,media:null,needsPhoto:i.kind==='photo'}));
 return {home:normalized,items,missingPhotos:items.filter(i=>i.needsPhoto).length};
}
module.exports={parseBackup};
