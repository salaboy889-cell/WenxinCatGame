const test=require('node:test'),assert=require('node:assert/strict');
const {initialHome,applyAction,dayKey}=require('../server/rules/home-state');
const {normalizeHome}=require('../server/rules/gameplay');
const {personality,dailyScene}=require('../js/rules/cat-life');
test('daily story is shared, one per cat per day, has no fish or growth reward, and survives normalization',()=>{
 const home=normalizeHome(structuredClone(initialHome),dayKey()),cat=home.family.parents[0],coins=home.coins,growth=cat.growth;
 const result=applyAction(home,'daily_story','me',{catId:cat.id,choice:0}).home;
 assert.equal(result.coins,coins);assert.equal(result.family.parents[0].growth,growth);assert.equal(result.family.parents[0].diary.length,1);
 assert.throws(()=>applyAction(result,'daily_story','you',{catId:cat.id,choice:1}),/已经记下/);
 const restored=normalizeHome(JSON.parse(JSON.stringify(result)),dayKey());assert.equal(dailyScene(restored.family.parents[0],dayKey()).done,true);
 assert.equal(dailyScene(restored.family.parents[0],'2099-01-01').done,false);
 assert.throws(()=>applyAction(home,'daily_story','guest',{catId:cat.id,choice:0}),/自己的小屋/);
 assert.throws(()=>applyAction(home,'daily_story','me',{catId:cat.id,choice:99}),/请选择/);
 home.family.parents[0].sleeping=true;assert.throws(()=>applyAction(home,'daily_story','me',{catId:cat.id,choice:0}),/睡觉/);
});
test('personality survives renaming and adoption; care milestone is recorded once',()=>{
 const home=normalizeHome(structuredClone(initialHome),dayKey()),cat=home.family.parents[0];cat.growth=149;
 assert.deepEqual(personality(cat),personality({...cat,name:'新名字'}));
 const first=applyAction(home,'pet','me',{catId:cat.id}).home,second=applyAction(first,'pet','you',{catId:cat.id}).home;
 assert.equal(second.family.parents[0].diary.filter(row=>row.id==='growth-150').length,1);
 assert.equal(second.family.parents[0].diary.filter(row=>row.id==='first-pet').length,1);
 assert.equal(home.family.parents[0].diary,undefined);
});

test('cumulative growth stages use 150, 400 and 800 without resetting growth',()=>{
 const {makeCat,stageIndex,stageProgress}=require('../server/rules/cat-family');
 for(const [growth,stage] of [[0,0],[149,0],[150,1],[399,1],[400,2],[799,2],[800,3],[1000,3]]){const cat={...makeCat('threshold','宝宝','boy',dayKey(),1),growth};assert.equal(stageIndex(cat,dayKey()),stage);if(growth===800)assert.equal(stageProgress(cat,dayKey()),100);}
 const home=normalizeHome(structuredClone(initialHome),dayKey());home.family.parents[0].growth=149;const result=applyAction(home,'pet','me',{catId:'cat-boy'});assert.equal(result.home.family.parents[0].growth,151);assert.equal(stageIndex(result.home.family.parents[0],dayKey()),1);
});
test('old growth migrates once by stage proportion and keeps adults adult',()=>{
 const {migrateGrowth}=require('../js/rules/growth-policy');for(const [old,current] of [[0,0],[25,150],[50,275],[75,400],[150,800],[200,900],[250,1000]]){const cat={growth:old};migrateGrowth(cat);assert.equal(cat.growth,current);migrateGrowth(cat);assert.equal(cat.growth,current);}
});

test('old untagged kittens retain the former twelve-appearance assignment during growth migration',()=>{
 const {migrateGrowth}=require('../js/rules/growth-policy'),cat={id:'old-missing-breed',generation:1,growth:150};migrateGrowth(cat);const id=cat.breedId;assert.ok(id);assert.equal(cat.growth,800);migrateGrowth(cat);assert.equal(cat.breedId,id);
});
