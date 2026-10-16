const {structuredClone,crypto}=require('../platform');
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.duetQuestions = void 0;
exports.resetAdventure = resetAdventure;
exports.normalizeHome = normalizeHome;
exports.questProgress = questProgress;
exports.visibleHome = visibleHome;
exports.adventureAction = adventureAction;
const cat_family_1 = require("./cat-family");
const daily_content_1 = require("./daily-content");
exports.duetQuestions = [
    { title: '给你们安排一个空闲周末，你最想…', options: ['去海边吹风 🌊', '窝在家里看电影 🍿', '逛街吃好吃的 🍜', '说走就走小旅行 🚗'] },
    { title: '小猫偷偷打翻了杯子，你会…', options: ['先抱起小猫 🐱', '赶紧收拾现场 🧹', '看看有没有受伤 🩹', '拍照记下这一刻 📸'] },
    { title: '想给对方准备一份小惊喜，你选…', options: ['亲手做一顿饭 🍳', '写一封小纸条 💌', '买个心动小礼物 🎁', '计划一次约会 🌷'] },
    { title: '今天想一起解锁的夜晚是…', options: ['散步看月亮 🌙', '一起打游戏 🎮', '认真聊一会儿 💬', '抱着小猫发呆 💤'] },
    { title: '你觉得恋爱里的“小幸福”是…', options: ['被记住小习惯 🧡', '一起做傻乎乎的事 😆', '想说话时有人听 🫶', '每天都能见到你 🐾'] },
];
function resetAdventure(day) { return { quest: { day, care: {}, play: {}, hug: {}, claimed: false }, duet: { day, answers: {}, claimed: false }, catchBest: { me: 0, you: 0 }, catchDays: {}, reactions: [] }; }
function normalizeHome(h, day) {
    const defaults = resetAdventure(day), a = { ...defaults, ...h.adventure };
    if (a.quest.day !== day)
        a.quest = defaults.quest;
    if (a.duet.day !== day)
        a.duet = defaults.duet;
    return (0, cat_family_1.normalizeFamily)({ ...h, roomName: h.roomName || '温馨猫屋', adventure: a }, day);
}
function questProgress(h) { var _a; const q = (_a = h.adventure) === null || _a === void 0 ? void 0 : _a.quest; if (!q)
    return 0; return ['care', 'play', 'hug'].reduce((sum, k) => sum + Number(!!q[k].me) + Number(!!q[k].you), 0); }
function visibleHome(home, role) {
    const h = structuredClone(home);
    if (!h.adventure)
        return h;
    const d = h.adventure.duet, me = !!d.answers.me, you = !!d.answers.you;
    d.submitted = { me, you };
    if (!(me && you)) {
        const mine = d.answers[role];
        d.answers = mine ? { [role]: mine } : {};
    }
    return h;
}
function adventureAction(home, action, role, payload, day) {
    var _a;
    const h = normalizeHome(structuredClone(home), day), a = h.adventure;
    if (action === 'hug') {
        const kind = payload.kind === 'cheer' ? 'cheer' : payload.kind === 'miss' ? 'miss' : 'hug';
        const todayMessages = ((_a = a.dailyPhrases) === null || _a === void 0 ? void 0 : _a.day) === day ? a.dailyPhrases.messages : (0, daily_content_1.fallbackContent)(day).messages;
        a.reactions.unshift({ id: crypto.randomUUID(), role, createdAt: new Date().toISOString(), text: todayMessages[kind] });
        a.reactions = a.reactions.slice(0, 12);
        if (!a.quest.hug[role]) {
            a.quest.hug[role] = true;
            h.coins += 5;
            h.love += 2;
        }
        return { home: h, message: '心意已经留在小屋里，对方打开就能看到 ♡' };
    }
    if (action === 'catch') {
        const score = Number(payload.score);
        if (!Number.isInteger(score) || score < 0 || score > 60)
            throw new Error('这局分数不对，重新玩一局吧');
        const key = role + '-' + day, plays = a.catchDays[key] || 0;
        a.catchDays[key] = plays + 1;
        a.catchBest[role] = Math.max(a.catchBest[role] || 0, score);
        a.quest.play[role] = true;
        const reward = plays < 5 ? Math.min(30, 5 + score) : 0;
        h.coins += reward;
        h.love += 1;
        return { home: h, message: reward ? `接到 ${score} 条小鱼，小鱼干 +${reward}` : '分数已记下，今天的接鱼奖励领满啦' };
    }
    if (action === 'quest_claim') {
        if (a.quest.claimed)
            throw new Error('今天的双人奖励已经领过啦');
        if (questProgress(h) < 6)
            throw new Error('你们俩都完成三个小任务，就能一起领奖');
        a.quest.claimed = true;
        h.coins += 60;
        h.love += 8;
        return { home: h, message: '双人任务完成！共同获得 60 小鱼干和 8 亲密度' };
    }
    if (action === 'duet_submit') {
        const answer = payload.answers;
        if (!Array.isArray(answer) || answer.length !== exports.duetQuestions.length || answer.some((v) => !Number.isInteger(v) || Number(v) < 0 || Number(v) > 3))
            throw new Error('先答完五道题，再把答案交给小猫');
        if (a.duet.answers[role])
            throw new Error('今天已经交过答案啦，等另一位来揭晓');
        a.duet.answers[role] = answer;
        a.quest.play[role] = true;
        if (a.duet.answers.me && a.duet.answers.you && !a.duet.claimed) {
            const same = answer.filter((v, i) => v === a.duet.answers[role === 'me' ? 'you' : 'me'][i]).length;
            a.duet.claimed = true;
            h.coins += 25 + same * 5;
            h.love += 5;
            return { home: h, message: `默契结果揭晓！${same} 道题心意相通，小鱼干 +${25 + same * 5}` };
        }
        return { home: h, message: '答案交给小猫啦，另一位答完后一起揭晓' };
    }
    return null;
}
