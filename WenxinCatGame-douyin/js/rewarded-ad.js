const config=require('../config');
function enabled(){return /^adunit-[A-Za-z0-9_-]+$/.test(config.rewardedAdUnitId||'')&&typeof tt.createRewardedVideoAd==='function';}
function play(page){
 if(!enabled())return Promise.reject(Error('广告还没开通，先玩小游戏攒鱼干吧'));
 if(page._adWaiting)return Promise.reject(Error('广告正在播放中'));
 if(!page._rewardedAd){
  const ad=tt.createRewardedVideoAd({adUnitId:config.rewardedAdUnitId});page._rewardedAd=ad;
  ad.onClose(result=>{if(page._adFinish)page._adFinish(!!(result&&result.isEnded));});
  ad.onError(()=>{if(page._adFail)page._adFail(Error('广告暂时播不了，先玩小游戏吧'));});
 }
 const ad=page._rewardedAd;page._adWaiting=true;
 return new Promise((resolve,reject)=>{
  let settled=false;
  const finish=(error,ended)=>{if(settled)return;settled=true;page._adWaiting=false;page._adFinish=null;page._adFail=null;if(error)reject(error);else resolve(ended);};
  page._adFinish=ended=>finish(null,ended);page._adFail=error=>finish(error);
  Promise.resolve().then(()=>ad.show()).catch(()=>ad.load().then(()=>ad.show())).catch(error=>finish(error));
 });
}
module.exports={enabled,play};
