const api=require('./service');
async function confirmJoin(code,extra=''){
 const preview=await api.call('joinPreview',{code}),cats=preview.residentCats||[];
 const names=cats.map(cat=>`${cat.name}${cat.sex==='boy'?'♂':'♀'}`).join('、');
 const content=cats.length?`屋里已有 ${cats.length} 只猫：${names}。你愿意和它们一起生活、照顾它们吗？${extra}`:`这间小屋目前没有猫。加入后你们可以一起领养、照顾小猫。${extra}`;
 const answer=await new Promise(resolve=>wx.showModal({title:preview.roomName||'加入小屋',content,confirmText:'接受入住',cancelText:'暂不加入',success:resolve,fail:()=>resolve({confirm:false})}));
 return answer.confirm?{code,acceptResidentCats:true,consentToken:preview.consentToken}:null;
}
module.exports={confirmJoin};
