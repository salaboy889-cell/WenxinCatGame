// 40 game catalog entries; aliases retain existing cats and coat images.
const breeds=[
 {
  "intro": "圆脸蓝灰短毛，铜色眼睛。",
  "detail": "圆圆的脸颊、蓝灰色短毛和铜色眼睛，是这只蓝猫宝宝的外观特点。",
  "label": "英短蓝猫",
  "id": "british-blue",
  "name": "英国短毛猫",
  "coat": "蓝猫",
  "kind": "品种",
  "group": "短毛类"
 },
 {
  "intro": "银底虎斑纹，清晰又精神。",
  "detail": "银灰色底毛搭配深色虎斑纹，额头、身体和尾巴上都有清晰的条纹。",
  "label": "美短银虎斑",
  "id": "american-tabby",
  "name": "美国短毛猫",
  "coat": "银虎斑",
  "kind": "品种",
  "group": "短毛类"
 },
 {
  "intro": "棕色狸花纹，条纹清楚。",
  "detail": "棕灰色底毛上分布着深色狸花条纹，额头、腿部和尾巴都有清晰纹路。",
  "label": "田园狸花",
  "id": "domestic-tabby",
  "name": "中华田园猫",
  "coat": "狸花",
  "kind": "花色",
  "group": "短毛类"
 },
 {
  "intro": "蓝眼重点色，身形纤细。",
  "detail": "浅色身体搭配深色面部、耳朵、四肢和尾巴，蓝眼睛与纤细轮廓很醒目。",
  "label": "暹罗猫",
  "id": "siamese",
  "name": "暹罗猫",
  "coat": "重点色",
  "kind": "品种",
  "group": "短毛类"
 },
 {
  "id": "exotic",
  "name": "异国短毛猫（加菲）",
  "label": "异国短毛猫",
  "coat": "橘色虎斑",
  "group": "短毛类",
  "intro": "圆脸短鼻，绒密短毛。",
  "detail": "圆润头脸、较短鼻部和浓密短毛，采用橘色虎斑外观。",
  "kind": "品种"
 },
 {
  "id": "oriental",
  "name": "东方短毛猫",
  "label": "东方短毛猫",
  "coat": "白色短毛",
  "group": "短毛类",
  "intro": "楔形脸，大耳朵，体态修长。",
  "detail": "脸部呈楔形，大耳朵与修长四肢醒目，短毛贴身。",
  "kind": "品种"
 },
 {
  "intro": "金色斑点外衣，像小豹。",
  "detail": "金色底毛搭配深色斑点与玫瑰状花纹，身体和尾巴上都有鲜明的纹路。",
  "label": "孟加拉豹猫",
  "id": "bengal",
  "name": "孟加拉豹猫",
  "coat": "金色斑点",
  "kind": "品种",
  "group": "短毛类"
 },
 {
  "intro": "蓝灰短毛，绿色眼睛。",
  "detail": "毛色是均匀的蓝灰色，绿色眼睛、直立的耳朵和较修长的脸部轮廓十分显眼。",
  "label": "俄罗斯蓝猫",
  "id": "russian-blue",
  "name": "俄罗斯蓝猫",
  "coat": "蓝灰短毛",
  "kind": "品种",
  "group": "短毛类"
 },
 {
  "id": "abyssinian",
  "name": "阿比西尼亚猫",
  "label": "阿比西尼亚猫",
  "coat": "红棕细纹",
  "group": "短毛类",
  "intro": "红棕细纹毛，轮廓轻盈。",
  "detail": "单根毛色带形成细腻的滴答纹，不是粗大虎斑，耳朵大而直立。",
  "kind": "品种"
 },
 {
  "id": "bombay",
  "name": "孟买猫",
  "label": "孟买猫",
  "coat": "乌黑短毛",
  "group": "短毛类",
  "intro": "黑亮短毛，铜色圆眼。",
  "detail": "采用乌黑贴身短毛与铜金色眼睛，轮廓圆润。",
  "kind": "品种"
 },
 {
  "id": "snowshoe",
  "name": "雪鞋猫",
  "label": "雪鞋猫",
  "coat": "海豹双色",
  "group": "短毛类",
  "intro": "蓝眼重点色，脚穿白袜。",
  "detail": "深色耳尾与面罩搭配白色口鼻、胸前和四只白脚，眼睛为蓝色。",
  "kind": "品种"
 },
 {
  "id": "singapura",
  "name": "新加坡猫",
  "label": "新加坡猫",
  "coat": "浅褐细纹",
  "group": "短毛类",
  "intro": "小巧体形，大眼浅褐毛。",
  "detail": "体形小巧、耳眼较大，象牙色底毛上有浅褐色细纹。",
  "kind": "品种"
 },
 {
  "id": "burmese",
  "name": "缅甸猫",
  "label": "缅甸猫",
  "coat": "深褐短毛",
  "group": "短毛类",
  "intro": "柔亮深褐毛，金色眼睛。",
  "detail": "采用浓郁深褐色短毛，身躯紧凑结实，金色眼睛明亮。",
  "kind": "品种"
 },
 {
  "id": "burmilla",
  "name": "波米拉猫",
  "label": "波米拉猫",
  "coat": "银色毛尖",
  "group": "短毛类",
  "intro": "银色毛尖，眼缘像描线。",
  "detail": "浅银底毛带深色毛尖，绿色眼睛周围的深色轮廓很有辨识度。",
  "kind": "品种"
 },
 {
  "id": "havana",
  "name": "哈瓦那棕猫",
  "label": "哈瓦那棕猫",
  "coat": "巧克力棕",
  "group": "短毛类",
  "intro": "通身巧克力棕，绿色眼睛。",
  "detail": "棕色短毛均匀柔亮，面部口鼻轮廓清楚，搭配绿色眼睛。",
  "kind": "品种"
 },
 {
  "intro": "白色长毛，圆脸蓬松。",
  "detail": "白色长毛包裹着圆圆的脸，鼻部较短，胸前和身体两侧都有蓬松的毛发。",
  "label": "波斯猫",
  "id": "persian",
  "name": "波斯猫",
  "coat": "白色长毛",
  "kind": "品种",
  "group": "长毛类"
 },
 {
  "intro": "蓝眼长毛，蓬松双色外衣。",
  "detail": "有蓝色眼睛和蓬松长毛，脸部、耳朵与尾巴的颜色较深，胸前毛色较浅。",
  "label": "布偶猫",
  "id": "ragdoll",
  "name": "布偶猫",
  "coat": "蓝双色",
  "kind": "品种",
  "group": "长毛类"
 },
 {
  "id": "chinchilla",
  "name": "金吉拉",
  "label": "金吉拉",
  "coat": "银白长毛",
  "group": "长毛类",
  "intro": "银白蓬松长毛，绿眼圆脸。",
  "detail": "这里作为波斯猫系的银色毛尖外观类型展示，并非所有协会都把金吉拉列为独立品种。",
  "kind": "外观类型"
 },
 {
  "id": "himalayan",
  "name": "喜马拉雅猫",
  "label": "喜马拉雅猫",
  "coat": "海豹重点色",
  "group": "长毛类",
  "intro": "圆脸长毛，蓝眼重点色。",
  "detail": "奶白色长毛搭配深色面部、耳、腿与尾，圆脸蓝眼；分类因猫协会而异。",
  "kind": "外观类型"
 },
 {
  "intro": "长毛大尾巴，耳尖有毛簇。",
  "detail": "身体覆盖较长的棕色虎斑毛，胸前毛发蓬松，耳尖毛簇与大尾巴很有辨识度。",
  "label": "缅因猫",
  "id": "maine-coon",
  "name": "缅因猫",
  "coat": "棕虎斑",
  "kind": "品种",
  "group": "长毛类"
 },
 {
  "id": "norwegian",
  "name": "挪威森林猫",
  "label": "挪威森林猫",
  "coat": "棕虎斑长毛",
  "group": "长毛类",
  "intro": "三角脸，厚围脖和大尾巴。",
  "detail": "长毛有明显层次，胸前围脖蓬松，脸形较长呈三角轮廓。",
  "kind": "品种"
 },
 {
  "id": "siberian",
  "name": "西伯利亚猫",
  "label": "西伯利亚猫",
  "coat": "银虎斑长毛",
  "group": "长毛类",
  "intro": "结实体态，厚实蓬松被毛。",
  "detail": "身体结实，脸形圆润，被毛厚实、尾巴蓬松，采用银虎斑外观。",
  "kind": "品种"
 },
 {
  "id": "angora",
  "name": "土耳其安哥拉猫",
  "label": "土耳其安哥拉猫",
  "coat": "白色丝毛",
  "group": "长毛类",
  "intro": "修长身形，白色丝质长毛。",
  "detail": "身形轻盈、耳朵直立，毛发柔顺有丝感，尾巴如羽饰。",
  "kind": "品种"
 },
 {
  "id": "somali",
  "name": "索马里猫",
  "label": "索马里猫",
  "coat": "红棕长毛",
  "group": "长毛类",
  "intro": "红棕层次毛，狐狸般大尾。",
  "detail": "毛色带细腻色带，耳朵直立，尾巴蓬松，整体像小狐狸。",
  "kind": "品种"
 },
 {
  "id": "balinese",
  "name": "巴厘猫",
  "label": "巴厘猫",
  "coat": "海豹重点色",
  "group": "长毛类",
  "intro": "蓝眼纤细，柔顺半长毛。",
  "detail": "类似暹罗的重点色和修长轮廓，带丝质半长毛与羽状尾巴。",
  "kind": "品种"
 },
 {
  "id": "tiffanie",
  "name": "蒂凡尼猫",
  "label": "蒂凡尼猫",
  "coat": "深褐半长毛",
  "group": "长毛类",
  "intro": "半长柔毛，尾巴蓬松。",
  "detail": "本目录采用亚洲半长毛猫Tiffanie的命名与外观，不与名称相近的Chantilly-Tiffany混为一类。",
  "kind": "外观类型"
 },
 {
  "id": "turkish-van",
  "name": "土耳其梵猫",
  "label": "土耳其梵猫",
  "coat": "白底红棕斑",
  "group": "长毛类",
  "intro": "白色身体，头尾带色斑。",
  "detail": "以大片白色半长毛为主，头顶部有红棕色斑块，尾巴颜色明显。",
  "kind": "品种"
 },
 {
  "id": "devon-rex",
  "name": "德文卷毛猫",
  "label": "德文卷毛猫",
  "coat": "灰色短卷毛",
  "group": "卷毛类",
  "intro": "大耳精灵脸，短软卷毛。",
  "detail": "大耳朵、短口鼻和精灵般脸形醒目，被毛短软带波纹。",
  "kind": "品种"
 },
 {
  "id": "cornish-rex",
  "name": "柯尼斯卷毛猫",
  "label": "柯尼斯卷毛猫",
  "coat": "奶油波纹毛",
  "group": "卷毛类",
  "intro": "修长拱背，贴身细波纹。",
  "detail": "身体修长、四肢长，短毛形成紧贴身体的细密波纹。",
  "kind": "品种"
 },
 {
  "id": "selkirk-rex",
  "name": "塞尔凯克卷毛猫",
  "label": "塞尔凯克卷毛猫",
  "coat": "银灰卷毛",
  "group": "卷毛类",
  "intro": "圆脸厚卷毛，像小绵羊。",
  "detail": "头脸圆润、毛量厚，身体与尾部都有蓬松卷曲的外观。",
  "kind": "品种"
 },
 {
  "id": "laperm",
  "name": "拉邦猫",
  "label": "拉邦猫",
  "coat": "橘色卷毛",
  "group": "卷毛类",
  "intro": "松软环状卷毛，胡须弯弯。",
  "detail": "被毛形成松散小卷与环状卷，颈部和尾巴尤为蓬松。",
  "kind": "品种"
 },
 {
  "id": "sphynx",
  "name": "斯芬克斯（加拿大无毛猫）",
  "label": "斯芬克斯",
  "coat": "粉色皮肤",
  "group": "特殊毛类",
  "intro": "大耳褶皱皮肤，细绒不显眼。",
  "detail": "皮肤纹理与褶皱清楚，外观近乎无毛，实际可有极细绒毛。",
  "kind": "品种"
 },
 {
  "id": "peterbald",
  "name": "彼得秃猫",
  "label": "彼得秃猫",
  "coat": "灰粉皮肤",
  "group": "特殊毛类",
  "intro": "大耳楔形脸，体形纤长。",
  "detail": "采用近乎无毛的外观，头脸呈楔形、耳朵大，体态比圆润的无毛猫更纤细。",
  "kind": "品种"
 },
 {
  "id": "lykoi",
  "name": "狼猫（Lykoi）",
  "label": "狼猫",
  "coat": "黑灰稀疏毛",
  "group": "特殊毛类",
  "intro": "稀疏杂色毛，脸像小狼。",
  "detail": "深浅混合的稀疏毛，眼周与口鼻毛发较少，形成独特的面罩轮廓。",
  "kind": "品种"
 },
 {
  "id": "scottish-fold",
  "name": "苏格兰折耳猫",
  "label": "苏格兰折耳猫",
  "coat": "蓝灰短毛",
  "group": "特殊形态",
  "intro": "圆脸圆眼，耳朵向前折。",
  "detail": "采用向前折叠的耳形与蓝灰短毛。游戏仅展示外形；现实折耳基因与骨软骨问题相关。",
  "kind": "品种"
 },
 {
  "id": "american-curl",
  "name": "美国卷耳猫",
  "label": "美国卷耳猫",
  "coat": "橘白半长毛",
  "group": "特殊形态",
  "intro": "耳尖向后卷，柔顺尾毛。",
  "detail": "耳尖向后弯曲，与向前折耳不同，采用橘白半长毛外观。",
  "kind": "品种"
 },
 {
  "id": "munchkin",
  "name": "曼基康（短腿猫）",
  "label": "曼基康",
  "coat": "橘色虎斑",
  "group": "特殊形态",
  "intro": "正常身长，四肢明显短小。",
  "detail": "采用短腿、正常身长与橘虎斑短毛的外观；游戏动作不代表现实运动能力。",
  "kind": "品种"
 },
 {
  "id": "minuet",
  "name": "拿破仑猫（米努特）",
  "label": "拿破仑猫",
  "coat": "银白长毛",
  "group": "特殊形态",
  "intro": "圆脸蓬松长毛，腿短短。",
  "detail": "结合圆润面部、蓬松长毛与短腿外观，也常用米努特这一名称。",
  "kind": "品种"
 },
 {
  "id": "manx",
  "name": "马恩岛猫（无尾猫）",
  "label": "马恩岛猫",
  "coat": "棕色虎斑",
  "group": "特殊形态",
  "intro": "后躯圆润，采用无尾外观。",
  "detail": "采用没有明显尾巴的类型；现实中同类也存在尾长差异，不是每只都完全无尾。",
  "kind": "品种"
 },
 {
  "id": "japanese-bobtail",
  "name": "日本短尾猫",
  "label": "日本短尾猫",
  "coat": "三花短尾",
  "group": "特殊形态",
  "intro": "白底三花，小绒球短尾。",
  "detail": "采用白底黑橘色斑，尾巴短而弯曲，形似小绒球，不是长尾截断。",
  "kind": "品种"
 }
];
const legacyCoats=[{"intro": "金色渐层毛，圆脸绿眼。", "detail": "金色毛发带有深浅渐层，脸颊圆润，胸前与腹部较浅，绿色眼睛很明亮。", "label": "英短金渐层", "id": "british-golden", "name": "英国短毛猫", "coat": "金渐层", "kind": "品种"}, {"intro": "暖橘色条纹，像小太阳。", "detail": "暖橘色毛发搭配深浅条纹，口鼻与胸前较浅，整只宝宝看起来像一团小太阳。", "label": "田园橘猫", "id": "domestic-orange", "name": "中华田园猫", "coat": "橘猫", "kind": "花色"}, {"intro": "黑白橘三色，花斑独特。", "detail": "白色底毛搭配黑色和橘色花斑，脸部、背部与尾巴的颜色形成鲜明对比。", "label": "田园三花", "id": "domestic-calico", "name": "中华田园猫", "coat": "三花", "kind": "花色"}];
const aliases={'british-golden':'british-blue','domestic-orange':'domestic-tabby','domestic-calico':'domestic-tabby'};
function canonicalId(id){return aliases[id]||id;}
function hash(value){let n=2166136261;for(const ch of String(value)){n^=ch.charCodeAt(0);n=Math.imul(n,16777619);}return n>>>0;}
function breedFor(cat){return [...breeds,...legacyCoats].find(b=>b.id===cat.breedId)||(cat.generation===0?(cat.sex==='girl'?breeds.find(b=>b.id==='ragdoll'):legacyCoats[0]):breeds[hash(cat.id)%breeds.length]);}
function ensureBreed(cat){if(![...breeds,...legacyCoats].some(b=>b.id===cat.breedId))cat.breedId=breedFor(cat).id;return cat;}
function ensureLegacyBreed(cat){if(cat.generation>0&&!cat.breedId){const ids=['british-blue','american-tabby','ragdoll','siamese','maine-coon','persian','russian-blue','bengal','british-golden','domestic-tabby','domestic-orange','domestic-calico'];cat.breedId=ids[hash(cat.id)%ids.length];}return cat;}
module.exports={breeds,legacyCoats,breedFor,ensureBreed,canonicalId,ensureLegacyBreed};
