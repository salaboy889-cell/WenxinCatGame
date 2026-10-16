'use strict';
const {catInstructions}=require('./chat-ai');
const {validContent}=require('./rules/daily-content');
const MODEL='hy3';
function modelFor(ai){
 if(!ai||typeof ai.createModel!=='function')throw Object.assign(Error('云函数 AI 能力尚未就绪，请重新部署 mw-home'),{code:'AI_CONFIG'});
 // This provider consumes only the Growth Plan's free Hunyuan quota and stops at its limit.
 return ai.createModel('hunyuan-v3');
}
function cloudFault(error){
 const cause=String(error&&((error.code||error.errCode))||'UNKNOWN');
 console.error('MW_HUNYUAN_ERROR',{cause});
 if(cause==='EXCEED_TOKEN_QUOTA_LIMIT')return Object.assign(Error('混元免费额度尚未领取或已用完，请查看小程序成长计划'),{code:'AI_LIMIT'});
 if(cause==='AI_MODEL_NOT_SUPPORTED'||cause==='AI_MODEL_CONFIG_MISSING')return Object.assign(Error('请先在小程序成长计划领取混元 AI 资源包'),{code:'AI_CONFIG'});
 if(cause==='EXCEED_CONCURRENT_REQUEST_LIMIT'||cause==='429')return Object.assign(Error('小猫正在和其他朋友聊天，请稍后再试'),{code:'AI_LIMIT'});
 return Object.assign(Error('混元聊天暂时不可用，请在 mw-home 运行日志中查看 MW_HUNYUAN_ERROR'),{code:'AI_UNAVAILABLE'});
}
async function generateCloudCatReply({ai,name,sex,personality,profile,message,history}){
 const model=modelFor(ai),messages=[{role:'system',content:catInstructions({name,sex,personality,profile})},...history.map(item=>({role:item.role,content:item.text})),{role:'user',content:message}];
 let result;try{result=await model.generateText({model:MODEL,messages});}catch(error){throw cloudFault(error);}
 if(result&&result.error)throw cloudFault(result.error);
 const reply=result&&typeof result.text==='string'?result.text.trim():'';
 if(!reply)throw Object.assign(Error('小猫刚刚走神了，再说一次吧'),{code:'AI_BAD_REPLY'});
 return reply.slice(0,800);
}
async function generateCloudDailyContent({ai,day,previousTitles=[]}){
 const model=modelFor(ai),messages=[{role:'system',content:'你为两个人一起养猫的微信小屋创作每日互动。只输出 JSON 对象，不要 Markdown。字段 questions 为恰好 5 道轻松、有趣、不同的情侣默契题，每题有 title 和恰好 4 个简短 options；字段 messages 包含 hug、miss、cheer 三条不同的温暖短消息。不要出现真实姓名、隐私、照片或成人内容。'}, {role:'user',content:'日期：'+day+'。最近用过的题目：'+previousTitles.join('；')}];
 let result;try{result=await model.generateText({model:MODEL,messages});}catch(error){throw cloudFault(error);}
 if(result&&result.error)throw cloudFault(result.error);
 let content;try{const value=String(result&&result.text||'').trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');content=JSON.parse(value);}catch{throw Object.assign(Error('今日题目格式不完整'),{code:'AI_BAD_REPLY'});}
 if(!validContent(content))throw Object.assign(Error('今日题目格式不完整'),{code:'AI_BAD_REPLY'});
 return {day,source:'AI 每日更新',questions:content.questions,messages:content.messages};
}
module.exports={generateCloudCatReply,generateCloudDailyContent,MODEL};
