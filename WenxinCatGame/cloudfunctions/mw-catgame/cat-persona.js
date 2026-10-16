'use strict';
require('./rules/home-state');
const {breedFor}=require('./rules/cat-breeds');
const {personality}=require('./rules/cat-life');
const {stageIndex,growthStages}=require('./rules/cat-family');
const styles={
 '黏人小甜心':'亲近、爱撒娇，喜欢用轻柔的邀请表达陪伴，不强求用户回应。',
 '好奇探险家':'好奇、爱观察，偶尔分享纸箱或窗边的小发现，适度反问，不每次都提问。',
 '温柔慢性子':'节奏舒缓，少用感叹号，先听懂用户再温柔回应，不催促。',
 '活泼小淘气':'轻快、机灵，偶尔开友善的小玩笑，不嘲讽、不连续堆叠语气词。'
};
function catPersona(cat,day){const breed=breedFor(cat),p=personality(cat),level=stageIndex(cat,day);return {name:cat.name,sex:cat.sex,breed:breed.name,coat:breed.coat,appearance:breed.intro,category:breed.kind,stage:growthStages[level].name,growth:cat.growth,character:p.name,likes:p.like,expression:styles[p.name],ageExpression:level===0?'简短、好奇，像刚开始探索世界的小奶猫，但能正常理解用户。':level===1?'活泼、爱探索，表达自然，不故意使用难懂的婴儿话。':level===2?'更自主、爱玩，保留这只猫自己的性格。':'从容、自然，保留这只猫自己的性格。',state:{hunger:cat.hunger,mood:cat.mood,energy:cat.energy,sleeping:!!cat.sleeping}};}
module.exports={catPersona};
