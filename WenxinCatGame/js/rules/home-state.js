const {structuredClone,crypto}=require('../platform');
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.shop = exports.initialHome = void 0;
exports.dayKey = dayKey;
exports.applyAction = applyAction;
const cat_family_1 = require("./cat-family");
const gameplay_1 = require("./gameplay");
exports.initialHome = { roomName: '温馨猫屋', catName: cat_family_1.parentNames.boy, me: '我', you: '宝贝', together: '', hunger: 68, mood: 76, energy: 82, love: 0, coins: 120, outfit: 'none', theme: 'cream', sleeping: false, owned: ['none', 'cream'], checkins: {}, gameDays: {}, best: 0, visits: { me: 0, you: 0 } };
exports.shop = [
    { id: 'bow', name: '樱桃蝴蝶结', price: 40, type: 'outfit', icon: '🎀', desc: '一点点甜，刚刚好' },
    { id: 'scarf', name: '小小围巾', price: 55, type: 'outfit', icon: '🧣', desc: '把温暖围在脖子上' },
    { id: 'flower', name: '雏菊发夹', price: 65, type: 'outfit', icon: '🌼', desc: '今天也开一朵小花' },
    { id: 'sage', name: '森林午后', price: 80, type: 'theme', icon: '🌿', desc: '让小屋变成浅浅的绿' },
    { id: 'rose', name: '落日玫瑰', price: 80, type: 'theme', icon: '🌷', desc: '粉色的晚风吹进窗' },
];
function dayKey(now = new Date()) { return new Date(now.getTime() + 8 * 3600000).toISOString().slice(0, 10); }
function applyAction(current, action, role, payload = {}, serverDay = null) {
    const today = serverDay || dayKey(), h = (0, gameplay_1.normalizeHome)(structuredClone(current), today), familyResult = (0, cat_family_1.familyAction)(h, action, role, payload, today);
    if (familyResult)
        return familyResult;
    const special = (0, gameplay_1.adventureAction)(h, action, role, payload, today);
    if (special)
        return special;
    const name = role === 'guest' ? '访客' : role === 'me' ? h.me : h.you;
    const count = () => { h.visits[role] = (h.visits[role] || 0) + 1; h.adventure.quest.care[role] = true; };
    switch (action) {
        case 'feed':
            if (h.sleeping)
                throw new Error('小猫睡着啦，先轻轻叫醒它吧');
            if (h.hunger >= 100)
                throw new Error('小猫的肚子已经圆滚滚啦，陪它玩一会儿吧');
            if (h.coins < 5)
                throw new Error('小鱼干还不够，玩一局翻牌就能攒起来');
            h.hunger = Math.min(100, h.hunger + 22);
            h.mood = Math.min(100, h.mood + 4);
            h.love += 2;
            h.coins -= 5;
            count();
            return { home: h, message: `${h.catName}吃得很开心，亲密度 +2` };
        case 'pet':
            if (h.sleeping)
                throw new Error('小猫正在做美梦，先让它睡一会儿');
            h.mood = Math.min(100, h.mood + 8);
            h.love += 1;
            count();
            return { home: h, message: `${h.catName}蹭了蹭${name}的手，亲密度 +1` };
        case 'sleep':
            h.sleeping = !h.sleeping;
            if (h.sleeping)
                h.energy = Math.min(100, h.energy + 20);
            return { home: h, message: h.sleeping ? '晚安，小猫咪。梦里也要有我们呀。' : '小猫伸了个懒腰：喵，想你啦！' };
        case 'checkin':
            if (h.checkins[role] === today)
                throw new Error('今天已经来陪小猫啦，明天再来领小鱼干');
            h.checkins[role] = today;
            h.coins += 15;
            h.love += 2;
            count();
            return { home: h, message: '今天的陪伴已记下，小鱼干 +15' };
        case 'game': {
            const key = `${role}-${today}`, plays = h.gameDays[key] || 0, moves = Number(payload.moves);
            if (!Number.isInteger(moves) || moves < 6 || moves > 1000)
                throw new Error('这局没有完成，继续配对吧');
            h.gameDays[key] = plays + 1;
            h.adventure.quest.play[role] = true;
            h.best = h.best ? Math.min(h.best, moves) : moves;
            const reward = plays < 5 ? 20 : 0;
            h.coins += reward;
            h.mood = Math.min(100, h.mood + 5);
            h.hunger = Math.max(20, h.hunger - 8);
            h.energy = Math.max(20, h.energy - 5);
            if (h.family.parents[0]) {
                h.family.parents[0].hunger = h.hunger;
                h.family.parents[0].energy = h.energy;
                h.family.parents[0].mood = h.mood;
            }
            return { home: h, message: reward ? '回忆配对完成，小鱼干 +20' : '配对完成！今天的奖励已领满，明天继续攒小鱼干' };
        }
        case 'shop': {
            const id = String(payload.id), item = exports.shop.find(i => i.id === id);
            if (id === 'none')
                h.outfit = 'none';
            else if (id === 'cream')
                h.theme = 'cream';
            else if (item) {
                if (!h.owned.includes(id)) {
                    if (h.coins < item.price)
                        throw new Error('小鱼干还差一点，去回忆闯关赚一些吧');
                    h.coins -= item.price;
                    h.owned.push(id);
                }
                if (item.type === 'outfit')
                    h.outfit = id;
                else
                    h.theme = id;
            }
            else
                throw new Error('没有找到这个装扮');
            if (id === 'none' || (item === null || item === void 0 ? void 0 : item.type) === 'outfit') {
                (0, cat_family_1.findCat)(h, payload.catId).outfit = h.outfit;
                (0, cat_family_1.syncPrimary)(h);
            }
            return { home: h, message: '换好啦，小猫的家又可爱了一点' };
        }
        case 'settings': {
            if (payload.roomName !== undefined) {
                const v = String(payload.roomName).trim();
                if (v.length < 1 || v.length > 20)
                    throw new Error('小屋名字请填 1～20 个字');
                h.roomName = v;
            }
            for (const key of ['catName', 'me', 'you']) {
                if (payload[key] !== undefined) {
                    const v = String(payload[key]).trim();
                    if (v.length < 1 || v.length > 16)
                        throw new Error('名字请填 1～16 个字');
                    h[key] = v;
                }
            }
            if (payload.together !== undefined) {
                const date = String(payload.together);
                if (date && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(new Date(date).getTime()) || new Date(date).toISOString().slice(0, 10) !== date || date > today))
                    throw new Error('请选择今天或之前的纪念日');
                h.together = date;
            }
            if (h.family.parents[0])
                h.family.parents[0].name = h.catName;
            if (payload.girlName !== undefined && h.family.parents[1]) {
                const v = String(payload.girlName).trim();
                if (!v || v.length > 16)
                    throw new Error('小猫名字请填 1～16 个字');
                h.family.parents[1].name = v;
            }
            (0, cat_family_1.syncPrimary)(h);
            return { home: h, message: '属于你们的小屋，已经记住这些名字啦' };
        }
        default: throw new Error('暂时没有这个操作');
    }
}
