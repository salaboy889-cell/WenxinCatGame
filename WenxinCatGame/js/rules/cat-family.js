const {ADULT_GROWTH,MAX_GROWTH,GROWTH_REVISION,migrateGrowth}=require('./growth-policy');
const {BABY_LIMIT}=require('./nursery-policy');
const {ensureBreed}=require('./cat-breeds');
const {structuredClone,crypto}=require('../platform');
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.catReady = exports.ageDays = exports.growthStages = exports.parentNames = exports.feedingGoal = void 0;
exports.stageIndex = stageIndex;
exports.stageProgress = stageProgress;
exports.makeCat = makeCat;
exports.initialFamily = initialFamily;
exports.syncPrimary = syncPrimary;
exports.normalizeFamily = normalizeFamily;
exports.allCats = allCats;
exports.findCat = findCat;
exports.careGrowth = careGrowth;
exports.familyRequirements = familyRequirements;
exports.familyAction = familyAction;
const cat_life_1 = require("./cat-life");
const home_state_1 = require("./home-state");
exports.feedingGoal = 12;
exports.parentNames = { boy: '公猫', girl: '母猫' };
exports.growthStages = [{ name: '小奶猫', min: 0, max: 150, scale: .53, icon: '🍼' }, { name: '幼猫', min: 150, max: 400, scale: .67, icon: '🐾' }, { name: '少年猫', min: 400, max: 800, scale: .8, icon: '🌱' }, { name: '成年猫', min: 800, max: 1000, scale: .94, icon: '🐈' }];
const daysBetween = (a, b) => Math.max(0, Math.floor((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000));
const ageDays = (cat, day) => daysBetween(cat.bornOn, day);
exports.ageDays = ageDays;
function stageIndex(cat, day) { if (cat.growth >= ADULT_GROWTH)
    return 3; return cat.growth >= 400 ? 2 : cat.growth >= 150 ? 1 : 0; }
function stageProgress(cat, day) { if(cat.growth>=ADULT_GROWTH)return 100;const stage = exports.growthStages[stageIndex(cat, day)]; return Math.min(100, Math.max(0, Math.floor((cat.growth - stage.min) / (stage.max - stage.min) * 100))); }
function makeCat(id, name, sex, day, generation = 0) { return { id, name, sex, color: sex === 'boy' ? 'cream' : 'lilac', bornOn: day, growth: 0, growthRevision:GROWTH_REVISION, lastGrowthDay: day, careDay: day, careXp: 0, hunger: 68, mood: 76, energy: 82, sleeping: false, outfit: 'none', generation, ...(generation>0?{breedId:require('./cat-breeds').breedFor({id}).id}:{}) }; }
function initialFamily(home, day, now = new Date().toISOString()) {
    const boy = makeCat('cat-boy', home.catName, 'boy', day);
    Object.assign(boy, { hunger: home.hunger, mood: home.mood, energy: home.energy, sleeping: home.sleeping, outfit: home.outfit });
    boy.growth = Math.min(24, Math.max(0, home.love));
    return { parents: [boy, makeCat('cat-girl', exports.parentNames.girl, 'girl', day)], kittens: [], bond: Math.min(20, home.love), nestBuilt: false, pending: null, lastBirthAt: null, feedingProgress: 0, events: [{ id: 'adoption', text: `${boy.name}和${exports.parentNames.girl}住进了你们的小屋。`, at: now }] };
}
function syncPrimary(home) { var _a; const p = (_a = home.family) === null || _a === void 0 ? void 0 : _a.parents[0]; if (p) {
    home.catName = p.name;
    home.hunger = p.hunger;
    home.mood = p.mood;
    home.energy = p.energy;
    home.sleeping = p.sleeping;
    home.outfit = p.outfit;
} return home; }
function normalizeFamily(home, day, now = new Date().toISOString()) {
    const h = { ...home, family: structuredClone(home.family || initialFamily(home, day, now)) };
    // Apply this requested rename once, so future names chosen in settings survive.
    if (h.family.parentNamesRevision !== 1) {
        for (const cat of h.family.parents) {
            if (cat.id === 'cat-boy')
                cat.name = exports.parentNames.boy;
            if (cat.id === 'cat-girl')
                cat.name = exports.parentNames.girl;
        }
        const adoption = h.family.events.find(e => e.id === 'adoption');
        if (adoption)
            adoption.text = `${exports.parentNames.boy}和${exports.parentNames.girl}住进了你们的小屋。`;
        h.family.parentNamesRevision = 1;
    }
    if (h.family.birthDay !== day) {
        h.family.birthDay = day;
        h.family.birthCount = h.family.lastBirthAt && (0, home_state_1.dayKey)(new Date(h.family.lastBirthAt)) === day ? 1 : 0;
    }
    if (h.family.milkDay !== day) {
        h.family.milkDay = day;
        h.family.nurseryMilk = 0;
        h.family.milkAdsCount = 0;
    }
    h.family.feedingProgress = Math.max(0, Math.min(exports.feedingGoal, Number(h.family.feedingProgress) || 0));
    for (const cat of [...h.family.parents, ...h.family.kittens]) {
        migrateGrowth(cat);ensureBreed(cat);
        const days = daysBetween(cat.lastGrowthDay, day);
        if (days) {
            cat.growth = Math.min(MAX_GROWTH, cat.growth + days * 2);
            cat.hunger = Math.max(30, cat.hunger - days * 6);
            cat.mood = Math.max(45, cat.mood - days * 2);
            cat.energy = Math.min(100, cat.energy + days * 6);
            cat.lastGrowthDay = day;
        }
        if (cat.careDay !== day) {
            cat.careDay = day;
            cat.careXp = 0;
        }
    }
    return syncPrimary(h);
}
function allCats(h) { return h.family ? [...h.family.parents, ...h.family.kittens] : []; }
function findCat(h, id) { const cat = allCats(h).find(c => c.id === (id || 'cat-boy')); if (!cat)
    throw new Error('先选一只要照顾的小猫'); return cat; }
function careGrowth(home,cat,amount,role='me',helperKey=''){
 let gained;
 if(role==='guest'){
  const day=home.family.birthDay,usage=cat.friendCare&&cat.friendCare.day===day?cat.friendCare:{day,total:0,users:{}};
  const key=helperKey||'anonymous';gained=Math.max(0,Math.min(amount,30-usage.total,10-(usage.users[key]||0),MAX_GROWTH-cat.growth));usage.total+=gained;usage.users[key]=(usage.users[key]||0)+gained;cat.friendCare=usage;
 }else{gained=Math.max(0,Math.min(amount,60-cat.careXp,MAX_GROWTH-cat.growth));cat.careXp+=gained;}
 cat.growth+=gained;if(gained>0)home.family.bond=Math.min(100,home.family.bond+1);return gained;
}
const catReady = (cat, day) => stageIndex(cat, day) === 3 && cat.hunger >= 40 && cat.mood >= 60 && cat.energy >= 40 && !cat.sleeping;
exports.catReady = catReady;
function familyRequirements(h, day, now = Date.now()) {
    const f = h.family, cats = [...f.parents, ...f.kittens];
    return { adult: cats.some(c => c.sex === 'boy' && stageIndex(c, day) === 3) && cats.some(c => c.sex === 'girl' && stageIndex(c, day) === 3), bond: f.bond >= 30, nest: f.nestBuilt, space: f.kittens.length < BABY_LIMIT, healthy: cats.some(c => c.sex === 'boy' && (0, exports.catReady)(c, day)) && cats.some(c => c.sex === 'girl' && (0, exports.catReady)(c, day)), milkReady: f.founderNursery === true || !(f.birthCount || 0) || (f.nurseryMilk || 0) > 0, litterLimit: f.founderNursery === true || (f.birthCount || 0) < 4, cooldown: true };
}
function familyAction(home, action, role, payload, day, now = new Date()) {
    const h = normalizeFamily(structuredClone(home), day, now.toISOString()), f = h.family, who = role === 'guest' ? '访客' : role === 'me' ? h.me : h.you;
    const finish = (message) => ({ home: syncPrimary(h), message });
    const event = (text) => { f.events.unshift({ id: crypto.randomUUID(), text, at: now.toISOString() }); f.events = f.events.slice(0, 10); };
    const addCare = () => {
        if (f.founderNursery) {
            for (const cat of f.parents.filter(c => c.generation === 0)) {
                cat.hunger = Math.max(60, cat.hunger);
                cat.mood = Math.max(75, cat.mood);
                cat.energy = Math.max(80, cat.energy);
                cat.sleeping = false;
            }
        }
        f.feedingProgress = Math.min(exports.feedingGoal, (f.feedingProgress || 0) + 1);
        const req = familyRequirements(h, day, now.getTime());
        if(!req.space)return '，宝宝房间住满啦，先帮宝宝找到新家吧；迎接进度已保留';
        if (f.feedingProgress < exports.feedingGoal || !req.adult || !req.space || !req.healthy || !req.milkReady || !req.litterLimit || f.pending)
            return '';
        const cats = [...f.parents, ...f.kittens], boy = cats.find(c => c.sex === 'boy' && (0, exports.catReady)(c, day)), girl = cats.find(c => c.sex === 'girl' && (0, exports.catReady)(c, day)), random = new Uint8Array(1);
        crypto.getRandomValues(random);
        const count = Math.min(1 + random[0] % 2, BABY_LIMIT - f.kittens.length), generation = 1 + Math.max(boy.generation, girl.generation), names = ['小团子', '小芝麻', '小桃子', '小糯球', '小布丁', '小奶盖'];
        for (let i = 0; i < count; i++) {
            crypto.getRandomValues(random);
            f.kittens.push(makeCat(crypto.randomUUID(), names[f.kittens.length%names.length]+(f.kittens.length>=names.length?Math.floor(f.kittens.length/names.length)+1:''), random[0] % 2 ? 'boy' : 'girl', day, generation));
            const newborn=f.kittens[f.kittens.length-1];newborn.birthOrigin='community';newborn.diary=[{id:'community-birth',day,text:'在大家共同的照顾下，来到这间猫屋。'}];
        }
        if (!f.founderNursery && (f.birthCount || 0) > 0)
            f.nurseryMilk = Math.max(0, (f.nurseryMilk || 0) - 1);
        f.birthCount = (f.birthCount || 0) + 1;
        if (!f.founderNursery)
            for (const parent of [boy, girl]) {
                parent.hunger = Math.max(0, parent.hunger - 15);
                parent.energy = Math.max(0, parent.energy - 20);
                parent.mood = Math.max(0, parent.mood - 5);
            }
        f.feedingProgress = 0;
        f.lastBirthAt = now.toISOString();
        h.love += 10;
        event(`${boy.name}和${girl.name}在大家的照顾下迎来了 ${count} 只宝宝。`);
        return `，小窝迎来 ${count} 只猫宝宝！`;
    };
    const remember = (cat, id, text) => { cat.diary = cat.diary || []; if (!cat.diary.some(row => row.id === id))
        cat.diary.unshift({ id, text, day }); cat.diary = cat.diary.slice(0, 40); };
    if (action === 'daily_story') {
        if (role === 'guest')
            throw new Error('回到自己的小屋，和小猫留下今天的故事吧');
        const cat = findCat(h, payload.catId), choice = Number(payload.choice);
        if (!Number.isInteger(choice) || choice < 0 || choice > 1)
            throw new Error('请选择一种陪伴方式');
        if (cat.storyDay === day)
            throw new Error('今天的故事已经记下，明天再来看看吧');
        if (cat.sleeping)
            throw new Error('小猫正在睡觉，等它醒来再一起玩吧');
        const scene = (0, cat_life_1.dailyScene)(cat, day);
        cat.storyDay = day;
        cat.storyResult = scene.ends[choice];
        cat.mood = Math.min(100, cat.mood + 5);
        remember(cat, 'story-' + day, cat.storyResult);
        return finish('今天的小故事已记下，开心 +5');
    }
    if (['feed', 'pet', 'sleep'].includes(action)) {
        const cat = findCat(h, payload.catId), beforeGrowth = cat.growth;
        let gained = 0;
        if (action === 'feed') {
            if (cat.sleeping)
                throw new Error(`${cat.name}正在睡觉，先轻轻叫醒它吧`);
            if (cat.hunger >= 100)
                throw new Error(`${cat.name}已经吃饱啦，摸摸它或换另一只猫吧`);
            if (h.coins < 5)
                throw new Error('小鱼干还不够，去游乐场玩一局吧');
            h.coins -= 5;
            cat.hunger = Math.min(100, cat.hunger + 22);
            cat.mood = Math.min(100, cat.mood + 4);
            h.love += 2;
            gained = careGrowth(h, cat, 4,role,payload.helperKey);
        }
        if (action === 'pet') {
            if (cat.sleeping)
                throw new Error(`${cat.name}正在做美梦，先让它睡一会儿`);
            cat.mood = Math.min(100, cat.mood + 8);
            h.love++;
            gained = careGrowth(h, cat, 2,role,payload.helperKey);
        }
        if (action === 'sleep') {
            if (!cat.sleeping) {
                if (h.coins < 3)
                    throw new Error('准备软毯需要 3 小鱼干，先去小游戏攒一点吧');
                h.coins -= 3;
            }
            cat.sleeping = !cat.sleeping;
            if (cat.sleeping) {
                cat.energy = Math.min(100, cat.energy + 20);
                gained = careGrowth(h, cat, 3,role,payload.helperKey);
            }
        }
        const firstId = 'first-' + action;
        cat.firstCare = cat.firstCare || [];
        if (!cat.firstCare.includes(action)) {
            cat.firstCare.push(action);
            remember(cat, firstId, action === 'feed' ? '第一次在这里吃到你准备的小鱼干。' : action === 'pet' ? '第一次把脑袋轻轻靠向你的手。' : cat.sleeping ? '第一次在你的照顾下安心入睡。' : '醒来后，伸了一个舒服的懒腰。');
        }
        for (const milestone of [150, 400, 800])
            if (beforeGrowth < milestone && cat.growth >= milestone) {
                cat.milestones = cat.milestones || [];
                if (!cat.milestones.includes(milestone)) {
                    cat.milestones.push(milestone);
                    remember(cat, 'growth-' + milestone, milestone === 800 ? '长成成年猫啦！谢谢你一路陪着我。' : milestone === 400 ? '长成少年猫啦，对这个小屋越来越熟悉。' : '告别小奶猫阶段，开始探索更大的世界。');
                }
            }
        h.visits[role] = (h.visits[role] || 0) + 1;
        if (h.adventure)
            h.adventure.quest.care[role] = true;
        const title = action === 'feed' ? `${cat.name}吃得很开心` : action === 'pet' ? `${cat.name}蹭了蹭${who}的手` : cat.sleeping ? `${cat.name}窝进小被子里睡着啦` : `${cat.name}伸了个懒腰`;
        return finish(title + (gained ? `，成长 +${gained}` : cat.careXp >= 60 ? '，今天的照顾成长值已收集满啦' : '') + (action === 'feed'||action==='pet'&&payload.nurseryPetCredit===true ? addCare() : ''));
    }
    if (action === 'family_help') {
        if (!f.parents.length && !f.kittens.length)
            throw new Error('先领养一只小猫再来照顾小窝吧');
        if (h.coins < 2)
            throw new Error('小鱼干不够啦，玩小游戏可以免费赚');
        h.coins -= 2;
        h.love++;
        f.bond = Math.min(100, f.bond + 1);
        return finish(`${who}给小窝添了一份奶和软毯，照顾进度 ${Math.min(exports.feedingGoal, (f.feedingProgress || 0) + 1)}/${exports.feedingGoal}` + addCare());
    }
    if (action === 'cat_rename') {
        const cat = findCat(h, payload.catId), name = String(payload.name || '').trim();
        if (!name || name.length > 16)
            throw new Error('小猫名字请填 1～16 个字');
        cat.name = name;
        return finish('小猫记住自己的新名字啦');
    }
    if (action === 'build_nest') {
        if (f.nestBuilt)
            throw new Error('共同的小窝已经布置好了');
        if (h.coins < 40)
            throw new Error('准备小窝需要 40 小鱼干，去游乐场攒一点吧');
        h.coins -= 40;
        f.nestBuilt = true;
        event('你们一起为猫咪布置好了软乎乎的小窝。');
        return finish('共同小窝准备好啦，给未来的猫宝宝留一点位置');
    }
    if (action === 'start_litter') {
        if (f.pending)
            throw new Error('猫宝宝已经在期待中了，先照顾好这一次吧');
        const req = familyRequirements(h, day, now.getTime());
        if (!req.litterLimit)
            throw new Error('这间小屋今天已迎接 4 窝，先照顾好现在的宝宝');
        if (!req.milkReady)
            throw new Error('今天的免费一窝已用，完整看广告领取育儿奶再来');
        if (!req.healthy && req.adult)
            throw new Error('先让公猫母猫吃饱、开心并休息好，再迎接宝宝');
        if (!req.adult)
            throw new Error('小屋里要有成年公猫和成年母猫，才能期待宝宝；同性猫可以一起生活');
        if (!req.bond)
            throw new Error('猫咪默契达到 30 后，就能期待猫宝宝');
        if (!req.nest)
            throw new Error('先给它们布置一个共同小窝吧');
        if (!req.space)
            throw new Error('宝宝房间的48个位置已满，先帮宝宝找到新家吧');
        if (!req.cooldown)
            throw new Error('上一窝宝宝刚来到小屋，过 7 天再期待下一窝吧');
        const cats = [...f.parents, ...f.kittens], boy = cats.find(c => c.sex === 'boy' && (0, exports.catReady)(c, day)), girl = cats.find(c => c.sex === 'girl' && (0, exports.catReady)(c, day));
        const random = new Uint8Array(1);
        crypto.getRandomValues(random);
        f.pending = { id: crypto.randomUUID(), dueAt: now.toISOString(), warmth: 0, expected: Math.min(1 + random[0] % 2, BABY_LIMIT - f.kittens.length), care: {}, parentIds: [boy.id, girl.id] };
        event(`${boy.name}和${girl.name}开始期待猫宝宝。`);
        return finish('开始期待猫宝宝啦！一起照顾小窝 4 次后就能迎接');
    }
    if (action === 'care_nest') {
        const p = f.pending;
        if (!p)
            throw new Error('还没有在期待中的猫宝宝');
        const key = day + '-' + role;
        if ((p.care[key] || 0) >= 2)
            throw new Error('你今天已经照顾小窝 2 次啦，另一位也可以来帮忙');
        if (h.coins < 2)
            throw new Error('铺毯子需要 2 小鱼干');
        h.coins -= 2;
        p.care[key] = (p.care[key] || 0) + 1;
        p.warmth++;
        h.love++;
        return finish(`${who}给小窝铺好了小毯子，暖心照顾 ${p.warmth}/4`);
    }
    if (action === 'welcome_kittens') {
        const p = f.pending;
        if (!p)
            throw new Error('这次的猫宝宝已经迎接过啦');
        const birthReq = familyRequirements(h, day, now.getTime());
        if (!birthReq.litterLimit)
            throw new Error('今天已经迎接 4 窝宝宝');
        if (!birthReq.milkReady)
            throw new Error('额外这一窝需要育儿奶，完整看广告领取后再来');
        if (p.warmth < 4)
            throw new Error(`小窝还需要照顾 ${4 - p.warmth} 次，再迎接猫宝宝吧`);
        if(!birthReq.adult||!birthReq.healthy)throw new Error('先让成年公猫母猫吃饱、开心并休息好，再迎接宝宝');
        if(f.kittens.length>=BABY_LIMIT)throw new Error('宝宝房间住满啦，先帮宝宝找到新家吧；迎接进度已保留');
        const birthCount=Math.min(p.expected,BABY_LIMIT-f.kittens.length);
        const nicknames = ['小团子', '小芝麻', '小桃子', '小糯球', '小布丁', '小奶盖'], parents = [...f.parents, ...f.kittens].filter(c => { var _a; return (_a = p.parentIds) === null || _a === void 0 ? void 0 : _a.includes(c.id); }), generation = 1 + Math.max(0, ...parents.map(c => c.generation));
        for (let i = 0; i < birthCount; i++) {
            const random = new Uint8Array(1);
            crypto.getRandomValues(random);
            f.kittens.push(makeCat(crypto.randomUUID(), nicknames[f.kittens.length%nicknames.length]+(f.kittens.length>=nicknames.length?Math.floor(f.kittens.length/nicknames.length)+1:''), random[0] % 2 ? 'boy' : 'girl', day, generation));
            const newborn=f.kittens[f.kittens.length-1];newborn.birthOrigin='community';newborn.diary=[{id:'community-birth',day,text:'在大家共同的照顾下，来到这间猫屋。'}];
        }
        if (!f.founderNursery && (f.birthCount || 0) > 0)
            f.nurseryMilk = Math.max(0, (f.nurseryMilk || 0) - 1);
        f.birthCount = (f.birthCount || 0) + 1;
        if (!f.founderNursery)
            for (const parent of parents) {
                parent.hunger = Math.max(0, parent.hunger - 15);
                parent.energy = Math.max(0, parent.energy - 20);
                parent.mood = Math.max(0, parent.mood - 5);
            }
        const count = birthCount;
        f.pending = null;
        f.lastBirthAt = now.toISOString();
        h.love += 10;
        event(`${count} 只猫宝宝出生啦！你们的小屋多了新的小脚印。`);
        return finish(`欢迎 ${count} 只猫宝宝！可以起名字、喂食，陪它们继续长大`);
    }
    return null;
}
