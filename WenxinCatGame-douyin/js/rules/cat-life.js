// Stable identity and daily scenes shared by client and authoritative rules.
function hash(value){let n=2166136261;for(const ch of String(value)){n^=ch.charCodeAt(0);n=Math.imul(n,16777619);}return n>>>0;}
const personalities=[
 {name:'黏人小甜心',like:'靠着你打呼噜',line:'你一来，我就想蹭蹭你的手。'},
 {name:'好奇探险家',like:'纸箱和窗边的新发现',line:'今天的小屋，会藏着什么惊喜呢？'},
 {name:'温柔慢性子',like:'软毯和安静的陪伴',line:'慢慢来，陪我坐一会儿就很好。'},
 {name:'活泼小淘气',like:'追玩具和躲猫猫',line:'来找我呀，我已经藏好啦！'}
];
const scenes=[
 {title:'纸箱里的秘密',text:'发现一个空纸箱，它先探进一只爪子，又回头看看你。',choices:['陪它探索纸箱','给纸箱铺软毯'],ends:['一起把纸箱变成了秘密基地。','在纸箱里铺了软毯，它满意地踩了踩。']},
 {title:'窗边的小光斑',text:'窗边落下一小片光，它盯着光斑，耳朵轻轻动了动。',choices:['陪它看一会儿','拿玩具逗逗它'],ends:['安静地看了一会儿窗外，把这个午后留了下来。','用玩具引它追了几步，它开心地翘起尾巴。']},
 {title:'藏起来的小玩具',text:'它把小玩具推到角落，像是在等你一起找。',choices:['一起找小玩具','陪它玩一局'],ends:['找回了藏起来的小玩具，它轻轻蹭了蹭你的手。','陪它玩了一会儿，小屋里多了一段快乐时光。']},
 {title:'一朵小花的邀请',text:'它在窗边嗅了嗅小花，然后凑到你身边。',choices:['陪它闻闻花香','给它一个摸摸头'],ends:['陪它在窗边闻了闻花香。','摸了摸它的头，它眯起眼睛回应了你。']},
 {title:'软毯上的小脚印',text:'它在软毯上认真踩奶，好像在准备最舒服的位置。',choices:['帮它整理软毯','坐在旁边陪它'],ends:['整理好了软毯，它把爪子舒舒服服地收起来。','坐在旁边陪它踩奶，听了一会儿轻轻的呼噜声。']},
 {title:'门口的小迎接',text:'它听见动静跑到门边，抬头等你回应。',choices:['轻轻和它打招呼','摸摸它的小脑袋'],ends:['轻轻叫了它的名字，它摇着尾巴走近你。','摸了摸来迎接的小脑袋，把今天的相见记了下来。']}
];
function personality(cat){if(cat.generation===0&&cat.id==='cat-boy')return personalities[1];if(cat.generation===0&&cat.id==='cat-girl')return personalities[0];return personalities[hash(cat.id+'|'+cat.bornOn)%personalities.length];}
function dailyScene(cat,day){const scene=scenes[hash(cat.id+'|'+day)%scenes.length];return {...scene,done:cat.storyDay===day,result:cat.storyDay===day?cat.storyResult||'今天的陪伴已经记下。':''};}
module.exports={personality,dailyScene};
