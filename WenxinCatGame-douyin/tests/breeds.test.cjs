const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {breeds,breedFor}=require('../js/rules/cat-breeds');
require('../js/rules/home-state');require('../server/rules/home-state');
const {makeCat}=require('../js/rules/cat-family');
test('every breed has distinct idle and sleeping assets under 200KB, shared rules match, and newborn identity stays stable',()=>{
 assert.equal(breeds.length,40);assert.equal(new Set(breeds.map(b=>b.id)).size,40);
 assert.deepEqual(breeds,require('../server/rules/cat-breeds').breeds);
 const seen=new Set();for(let i=0;i<2000;i++){const cat=makeCat('breed-test-'+i,'宝宝',i%2?'boy':'girl','2026-10-15',1);seen.add(cat.breedId);assert.equal(breedFor({...cat,name:'新名字',growth:150}).id,cat.breedId);}assert.equal(seen.size,40);
 for(const b of breeds)for(const pose of ['idle','sleep']){const stat=fs.statSync(path.join(__dirname,'../assets/breeds',b.id+'-'+pose+'.png'));assert.ok(stat.size>1000&&stat.size<200*1024);}
});

test('legacy coat aliases keep their original assets while belonging to one of the forty categories',()=>{
 const {legacyCoats,canonicalId}=require('../js/rules/cat-breeds');assert.equal(legacyCoats.length,3);for(const b of legacyCoats){assert.equal(breedFor({breedId:b.id}).id,b.id);assert.ok(breeds.some(x=>x.id===canonicalId(b.id)));for(const pose of ['idle','sleep'])assert.ok(fs.existsSync(path.join(__dirname,'../assets/breeds',b.id+'-'+pose+'.png')));}
});
