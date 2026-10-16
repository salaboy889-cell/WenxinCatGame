const GAME_FISH_DAILY_LIMIT=80,GAME_REWARD_ROUNDS=5,AD_FISH_REWARD=20;
function gameRewardState(user,day){const raw=user.gameRewardUsage;return raw&&raw.day===day?raw:{day,fish:0,catch:0,game:0};}
function gameReward(user,day,action,score,capacity=Infinity){const usage=gameRewardState(user,day),raw=usage[action]<GAME_REWARD_ROUNDS?(action==='catch'?Math.min(30,5+score):20):0,reward=Math.max(0,Math.min(raw,GAME_FISH_DAILY_LIMIT-usage.fish,capacity));usage[action]++;usage.fish+=reward;user.gameRewardUsage=usage;return reward;}
module.exports={GAME_FISH_DAILY_LIMIT,GAME_REWARD_ROUNDS,AD_FISH_REWARD,gameRewardState,gameReward};
