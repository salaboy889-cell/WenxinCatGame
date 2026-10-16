const {CatGame}=require('./js/game');
const info=wx.getWindowInfo?wx.getWindowInfo():wx.getSystemInfoSync(),canvas=wx.createCanvas(),dpr=Math.min(info.pixelRatio||2,2);
canvas.width=info.windowWidth*dpr;canvas.height=info.windowHeight*dpr;canvas.getContext('2d').scale(dpr,dpr);
const game=new CatGame(canvas,info.windowWidth,info.windowHeight);
game.start();
wx.onTouchStart(e=>game.touchStart(e.touches[0]));wx.onTouchMove(e=>game.touchMove(e.touches[0]));wx.onTouchEnd(e=>game.touchEnd(e.changedTouches[0]));wx.onTouchCancel(()=>game.cancelTouch());
wx.onHide(()=>game.hide());wx.onShow(options=>game.show(options));
if(wx.onWindowResize)wx.onWindowResize(({windowWidth,windowHeight})=>{canvas.width=windowWidth*dpr;canvas.height=windowHeight*dpr;canvas.getContext('2d').scale(dpr,dpr);game.resize(windowWidth,windowHeight);});
