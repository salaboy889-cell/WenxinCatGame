# 猫屋品种素材

来源：内置  生成的单张透明素材图，裁切为 24 张姿态资源；非网上摄影素材。每张为 240 × 240 PNG，保留透明背景，均小于 200 KB。

本版包含 12 种品种／花色外观；英国短毛猫的蓝猫与金渐层属于同品种不同花色，中华田园猫的狸花、橘猫、三花为花色分类。不是全球猫品种全集。

新猫出生时通过随机生成的身份编号确定 breedId，随后持久保存；领养和赠送保留该值。旧宝宝若没有 breedId，按原身份确定稳定外观，名字和成长不变。游戏外观分配不模拟现实遗传。

生成提示词：Production transparent game sprite atlas, exactly 6 columns × 4 rows. Each adjacent pair is the same full-body photorealistic cat sitting then sleeping. Row 1: blue British Shorthair, silver tabby American Shorthair, blue point Ragdoll. Row 2: seal point Siamese, brown tabby Maine Coon, white Persian. Row 3: Russian Blue, golden spotted Bengal, golden shaded British Shorthair. Row 4: Chinese brown tabby domestic shorthair, orange tabby domestic shorthair, calico domestic shorthair. Consistent scale, studio lighting, clean separated alpha silhouettes, no text or accessories.

扩展时，在两份 rules/cat-breeds.js 的 breeds 列表加入项目，并增加同名 -idle.png 与 -sleep.png。改动既有目录顺序会影响未写入 breedId 的旧猫，因此上线后应只追加新项目，并先完成旧数据持久化。


2026-10-15 修复：原图按格裁切混入相邻猫尾巴，现已重新提取各自主体、独立裁切缅因猫边界并统一透明边距。逐张检查24张图片，每张只保留一个猫咪主体、四周透明，图片均小于200KB。原有品种标识与领养数据不变。
