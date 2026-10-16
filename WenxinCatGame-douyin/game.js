const {CatGame}=require('./js/game');
const info=tt.getWindowInfo?tt.getWindowInfo():tt.getSystemInfoSync(),canvas=tt.createCanvas(),dpr=Math.min(info.pixelRatio||2,2);
canvas.width=info.windowWidth*dpr;canvas.height=info.windowHeight*dpr;canvas.getContext('2d').scale(dpr,dpr);
const game=new CatGame(canvas,info.windowWidth,info.windowHeight);
game.start();
tt.onTouchStart(e=>game.touchStart(e.touches[0]));tt.onTouchMove(e=>game.touchMove(e.touches[0]));tt.onTouchEnd(e=>game.touchEnd(e.changedTouches[0]));tt.onTouchCancel(()=>game.cancelTouch());
tt.onHide(()=>game.hide());tt.onShow(options=>game.show(options));
if(tt.onWindowResize)tt.onWindowResize(({windowWidth,windowHeight})=>{canvas.width=windowWidth*dpr;canvas.height=windowHeight*dpr;canvas.getContext('2d').scale(dpr,dpr);game.resize(windowWidth,windowHeight);});

if(tt.getLaunchOptionsSync){const options=tt.getLaunchOptionsSync();if(options&&options.query)game.show(options);}
