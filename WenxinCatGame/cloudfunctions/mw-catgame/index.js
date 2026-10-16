const cloud=require('wx-server-sdk');
const {createHandler}=require('./core');
cloud.init({env:cloud.DYNAMIC_CURRENT_ENV,timeout:55000});
const handler=createHandler({db:cloud.database(),storage:cloud,getCloudAI:()=>typeof cloud.ai==='function'?cloud.ai():null});
exports.main=async event=>{
 try{const uid=require('./identity').userId(cloud.getWXContext());const data=await handler(event||{},uid);return {ok:true,data};}
 catch(error){
  const known=error.code&&/^(BAD_|NO_ROOM$|NOT_FOUND$|FORBIDDEN$|UNAUTHENTICATED$|RENAME_LIMIT$|ROOM_|ALREADY_JOINED$|RATE_LIMIT$|MEMORY_LIMIT$|NOT_EMPTY$|GROWTH_UNAVAILABLE$|CAT_NOT_READY$|BOOST_LIMIT$|NO_FOUNDER$|MERGE_UNAVAILABLE$|NOT_READY$|NEED_PARTNER$|CAT_FULL$|PLAN_PENDING$|TOO_YOUNG$|ALREADY_APPROVED$|AD_|CAT_HUNGRY$|AI_)/.test(error.code);
  if(!known)console.error('MW_HOME_ERROR',{method:event&&event.method,code:error.code||null,errCode:error.errCode||null,name:error.name||null});
  return {ok:false,error:{code:known?error.code:'SAVE_FAILED',message:known?error.message:(error.message&&/小猫|小屋|小鱼|今天|名字|纪念日|照片|猫宝宝|默契|先|你们|这局|分数|愿望/.test(error.message)?error.message:'小屋暂时没有保存成功，请稍后重试')}};
 }
};
