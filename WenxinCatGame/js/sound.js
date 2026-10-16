// Real recordings cut from the user's video. Default on, no switch, no pitch shifting.
const names=['small-1','small-2','young-1','young-2','teen','adult-boy','adult-girl','hungry','purr','message'];
const effects=['tap','coin','match','celebrate'];
const contexts={};let current=null,pending=null,index=0;
function voiceFor(cat={},action='pet'){
 if(action==='message')return 'message';
 if(action==='sleep')return cat.sleeping?voiceFor({...cat,sleeping:false},'wake'):'purr';
 if(action==='welcome'||action==='ambient'){if(cat.sleeping)return 'purr';if(cat.hunger<40)return 'hungry';}
 if(action==='feed'||action==='happy'){const g=Number(cat.growth)||0;return g<150?'small-'+(index++%2+1):g<400?'young-'+(index++%2+1):g<800?'teen':cat.sex==='girl'?'adult-girl':'adult-boy';}
 if(action==='pet'&&cat.mood>=90)return 'purr';
 const g=Number(cat.growth)||0;
 return g<150?'small-'+(index++%2+1):g<400?'young-'+(index++%2+1):g<800?'teen':cat.sex==='girl'?'adult-girl':'adult-boy';
}
function context(name){if(!names.includes(name)&&!effects.includes(name)||typeof wx.createInnerAudioContext!=='function')return null;if(!contexts[name]){const a=wx.createInnerAudioContext();a.src='assets/sfx/'+(names.includes(name)?'voice-':'')+name+'.mp3';a.loop=false;a.volume=names.includes(name)?name==='purr'?.30:name==='hungry'?.34:.40:.36;if(a.onError)a.onError(()=>{if(current===name)pending=name;});if(a.onPlay)a.onPlay(()=>{if(current===name)pending=null;});contexts[name]=a;}return contexts[name];}
function playVoice(name){if(!names.includes(name))return;stopVoices();current=name;const a=context(name);if(!a)return;try{a.stop();a.play();}catch(e){pending=name;}}
function stopVoices(){pending=null;for(const name of names)if(contexts[name])contexts[name].stop();current=null;}
function play(name){if(names.includes(name))return playVoice(name);if(!effects.includes(name))return;const a=context(name);if(a)try{a.stop();a.play();}catch(e){}}
function playMeow(cat,action='pet'){playVoice(voiceFor(cat,action));}
function playWelcome(cat){playMeow(cat||{},'welcome');}
function playNotification(){playVoice('message');}
function resumeWelcome(){if(pending){const name=pending;pending=null;playVoice(name);}}
function stopAll(){stopVoices();for(const name of effects)if(contexts[name])contexts[name].stop();}
module.exports={play,playMeow,playWelcome,playNotification,resumeWelcome,stopAll,voiceFor};
