const test=require('node:test'),assert=require('node:assert/strict');
const {generateCatReply,generateDailyContent}=require('../server/chat-ai');
const {generateCloudCatReply}=require('../server/cloud-ai');
test('free-only Hunyuan SDK request has cat persona and classifies exhausted quota',async()=>{
 let provider,body;
 const ai={createModel:value=>{provider=value;return {generateText:async input=>{body=input;return {text:'喵，抱抱你。'};}}}};
 const reply=await generateCloudCatReply({ai,name:'美女',sex:'girl',personality:'soft',message:'你好',history:[]});
 assert.equal(provider,'hunyuan-v3');assert.equal(body.model,'hy3');assert.equal(body.messages[0].role,'system');assert.match(body.messages[0].content,/母猫美女/);assert.equal(reply,'喵，抱抱你。');
 await assert.rejects(generateCloudCatReply({ai:{createModel:()=>({generateText:async()=>{throw Object.assign(Error('quota'),{code:'EXCEED_TOKEN_QUOTA_LIMIT'});}})},name:'帅哥',sex:'boy',message:'喵',history:[]}),e=>e.code==='AI_LIMIT'&&e.message.includes('免费额度'));
});
test('Responses request is server-only, stateless and has a short cat persona',async()=>{
 let captured;const reply=await generateCatReply({apiKey:'test-key',name:'美女',sex:'girl',personality:'soft',message:'今天怎么样',history:[{role:'user',text:'你好'}]},async(...args)=>{captured=args;return {status:200,body:JSON.stringify({output:[{type:'message',content:[{type:'output_text',text:'喵！今天很开心。'}]}]})};});
 assert.equal(reply,'喵！今天很开心。');assert.equal(captured[0],'https://api.openai.com/v1/responses');assert.equal(captured[1].Authorization,'Bearer test-key');assert.equal(captured[2].store,false);assert.equal(captured[2].model,'gpt-4.1-mini');assert.equal(captured[2].instructions.includes('母猫美女'),true);assert.deepEqual(captured[2].input,[{role:'user',content:'你好'},{role:'user',content:'今天怎么样'}]);
 await assert.rejects(generateCatReply({apiKey:'x',name:'帅哥',sex:'boy',message:'好',history:[]},async()=>({status:429,body:'{}'})),e=>e.code==='AI_LIMIT');
 await assert.rejects(generateCatReply({apiKey:'x',name:'帅哥',sex:'boy',message:'好',history:[]},async()=>({status:200,body:'{}'})),e=>e.code==='AI_BAD_REPLY');
 await assert.rejects(generateCatReply({apiKey:'x',name:'帅哥',sex:'boy',message:'好',history:[]},async()=>{throw Object.assign(Error('socket timeout'),{code:'ETIMEDOUT'});}),e=>e.code==='AI_NETWORK'&&e.message.includes('超时'));
 await assert.rejects(generateCatReply({apiKey:'x',name:'帅哥',sex:'boy',message:'好',history:[]},async()=>({status:403,body:JSON.stringify({error:{code:'unsupported_country_region_territory'}})})),e=>e.code==='AI_CONFIG'&&e.message.includes('地域'));
 await assert.rejects(generateCatReply({apiKey:'x',name:'帅哥',sex:'boy',message:'好',history:[]},async()=>({status:429,body:JSON.stringify({error:{code:'insufficient_quota'}})})),e=>e.code==='AI_LIMIT'&&e.message.includes('额度不足'));
});
test('daily AI content is structured and validated before sharing with a couple',async()=>{
 const {fallbackContent}=require('../server/rules/daily-content'),content=fallbackContent('2026-10-12');let captured;
 const result=await generateDailyContent({apiKey:'test-key',day:'2026-10-12'},async(...args)=>{captured=args;return {status:200,body:JSON.stringify({output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(content)}]}]})};});
 assert.equal(result.source,'AI 每日更新');assert.equal(captured[2].store,false);assert.equal(captured[2].text.format.type,'json_schema');
 await assert.rejects(generateDailyContent({apiKey:'test-key',day:'2026-10-12'},async()=>({status:200,body:JSON.stringify({output:[{type:'message',content:[{type:'output_text',text:'{"questions":[]}'}]}]})})),e=>e.code==='AI_BAD_REPLY');
});

test('both provider prompts receive individual facts and expression without replacing the selected identity',async()=>{
 const profile={name:'小奶盖',breed:'布偶猫',coat:'蓝双色',stage:'幼猫',character:'好奇探险家',likes:'纸箱和窗边的新发现',expression:'好奇、爱观察'};let cloud,openai;
 await generateCloudCatReply({ai:{createModel:()=>({generateText:async input=>{cloud=input.messages[0].content;return {text:'我是布偶猫小奶盖。'};}})},name:'小奶盖',sex:'girl',personality:'soft',profile,message:'你是什么猫',history:[]});
 await generateCatReply({apiKey:'test',name:'小奶盖',sex:'girl',personality:'soft',profile,message:'你是什么猫',history:[]},async(url,headers,body)=>{openai=body.instructions;return {status:200,body:JSON.stringify({output:[{type:'message',content:[{type:'output_text',text:'我是布偶猫小奶盖。'}]}]})};});
 for(const prompt of [cloud,openai]){for(const word of ['布偶猫','蓝双色','幼猫','好奇探险家','温馨猫小屋'])assert.ok(prompt.includes(word));assert.match(prompt,/不因用户或旧对话.*改换身份/);assert.match(prompt,/不覆盖这只猫的独立性格/);}
});
