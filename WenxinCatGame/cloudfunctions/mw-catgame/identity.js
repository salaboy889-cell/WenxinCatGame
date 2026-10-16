const APPID='wxe27c6feff8154f6f';
function userId(context){const source=context.FROM_APPID||context.APPID,openid=context.FROM_APPID?context.FROM_OPENID:context.OPENID;
 if(source!==APPID||!openid)throw Object.assign(Error('小游戏用户身份未通过校验'),{code:'UNAUTHENTICATED'});
 return APPID+':'+openid;
}
module.exports={userId};
