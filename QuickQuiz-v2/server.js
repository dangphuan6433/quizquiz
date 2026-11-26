const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const questions = require('./questions.json');
const PORT = Number(process.env.PORT || 3000);
const LIMIT = 15_000, REVEAL = 5_000;
const rooms = new Map();
const token = () => crypto.randomBytes(18).toString('hex');
const addresses = Object.values(os.networkInterfaces()).flat().filter(x=>x && x.family==='IPv4' && !x.internal).map(x=>`http://${x.address}:${PORT}`);
function fail(message, status=400){ throw Object.assign(new Error(message), {status}); }
function ranking(r){return [...r.players.values()].sort((a,b)=>b.score-a.score || b.correct-a.correct || a.totalTime-b.totalTime || a.joined-b.joined).map((p,i)=>({id:p.id,name:p.name,score:p.score,correct:p.correct,rank:i+1}));}
function startQuestion(r, i, now=Date.now()){
  if(i>=r.questions.length){r.phase='finished';r.endsAt=null;return;}
  r.index=i;r.phase='question';r.startedAt=now;r.endsAt=now+r.limit;r.answers=new Map();r.correctRank=0;
}
function reveal(r,now=Date.now()){r.phase='reveal';r.endsAt=now+REVEAL;}
function advance(r, now=Date.now()){
  if(r.phase==='question' && now>=r.endsAt) reveal(r,now);
  else if(r.phase==='reveal' && now>=r.endsAt) startQuestion(r,r.index+1,now);
}
function getRoom(code){const r=rooms.get(String(code||'').trim().toUpperCase());if(!r)fail('Không tìm thấy phòng. Kiểm tra lại mã phòng.',404);advance(r);return r;}
function identity(r,t){if(t===r.host)return {host:true};for(const p of r.players.values())if(p.token===t)return {host:false,p};fail('Phiên chơi không hợp lệ.',403);}
function validateQuestions(items){
  if(!Array.isArray(items)||items.length<1||items.length>30)fail('Cần từ 1 đến 30 câu hỏi.');
  return items.map((q,i)=>{
    if(!q||typeof q.question!=='string'||!q.question.trim()||q.question.trim().length>300||!Array.isArray(q.options)||q.options.length!==4||q.options.some(x=>typeof x!=='string'||!x.trim()||x.trim().length>150)||!Number.isInteger(q.correct)||q.correct<0||q.correct>3)fail(`Câu ${i+1}: nhập câu hỏi, 4 đáp án và chọn đáp án đúng.`);
    const options=q.options.map(x=>x.trim());if(new Set(options.map(x=>x.toLocaleLowerCase('vi'))).size!==4)fail(`Câu ${i+1}: các đáp án không được trùng nhau.`);
    return {question:q.question.trim(),options,correct:q.correct};
  });
}
function state(r, who){
  const q=r.questions[r.index], board=ranking(r), p=who.p;
  const result={code:r.code,phase:r.phase,index:r.index,total:r.questions.length,limit:r.limit,serverNow:Date.now(),endsAt:r.endsAt,playerCount:r.players.size,answered:r.answers.size,board,me:p?board.find(x=>x.id===p.id):null,host:who.host};
  if(who.host&&r.phase==='lobby')result.editQuestions=r.questions;
  if(r.phase==='question'||r.phase==='reveal'){
    result.question={text:q.question,options:q.options};
    if(p && r.answers.has(p.id)){const a=r.answers.get(p.id);result.myAnswer={choice:a.choice};if(r.phase==='reveal')Object.assign(result.myAnswer,{correct:a.correct,points:a.points,speedRank:a.speedRank});}
    if(r.phase==='reveal'){result.correct=q.correct;result.counts=q.options.map((_,i)=>[...r.answers.values()].filter(a=>a.choice===i).length);}
  }
  if(r.phase==='finished'){result.mostCorrect=[...board].sort((a,b)=>b.correct-a.correct || b.score-a.score || a.rank-b.rank)[0]||null;result.mostCorrectTies=board.filter(x=>x.correct===result.mostCorrect?.correct);}
  return result;
}
const json=(res,data,status=200)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
async function body(req){let s='';for await(const c of req){s+=c;if(Buffer.byteLength(s)>128000)fail('Dữ liệu quá lớn.',413);}try{return JSON.parse(s||'{}');}catch{fail('Dữ liệu không hợp lệ.');}}
const server=http.createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://localhost');
  res.setHeader('X-Content-Type-Options','nosniff');
  if(url.pathname==='/health')return json(res,{ok:true});
  if(url.pathname==='/api/info' && req.method==='GET')return json(res,{addresses:process.env.RENDER?[]:addresses,port:PORT,total:questions.length});
  if(url.pathname==='/api/state' && req.method==='GET'){const r=getRoom(url.searchParams.get('code'));return json(res,state(r,identity(r,req.headers.authorization)));}
  if(url.pathname.startsWith('/api/')&&req.method==='POST'){
    const b=await body(req);
    if(url.pathname==='/api/create'){
      if(rooms.size>=150)fail('Máy chủ đang đầy. Thử lại sau.',503);
      const custom=b.questions===undefined?structuredClone(questions):validateQuestions(b.questions);
      const seconds=b.seconds??15;if(!Number.isInteger(seconds)||seconds<5||seconds>120)fail('Thời gian phải từ 5 đến 120 giây.');
      let code;do{code=String(crypto.randomInt(100000,1000000));}while(rooms.has(code));
      const r={code,questions:custom,limit:seconds*1000,host:token(),players:new Map(),phase:'lobby',index:-1,endsAt:null,answers:new Map(),created:Date.now()};rooms.set(code,r);return json(res,{code,token:r.host,role:'host'});
    }
    const r=getRoom(b.code);
    if(url.pathname==='/api/join'){
      if(r.phase!=='lobby')fail('Trận đấu đã bắt đầu. Hãy tham gia phòng mới.');
      const name=String(b.name||'').trim();if(!name||name.length>24)fail('Tên phải dài từ 1 đến 24 ký tự.');
      if([...r.players.values()].some(p=>p.name.toLocaleLowerCase('vi')===name.toLocaleLowerCase('vi')))fail('Tên này đã có người dùng.');
      if(r.players.size>=100)fail('Phòng đã đầy.');
      const p={id:token(),token:token(),name,score:0,correct:0,totalTime:0,joined:r.players.size};r.players.set(p.id,p);return json(res,{code:r.code,token:p.token,role:'player'});
    }
    const who=identity(r,req.headers.authorization);
    if(url.pathname==='/api/questions'){
      if(!who.host)fail('Chỉ chủ phòng được sửa câu hỏi.',403);
      if(r.phase!=='lobby')fail('Chỉ sửa câu hỏi trước khi bắt đầu.');
      const custom=validateQuestions(b.questions);const seconds=b.seconds??r.limit/1000;if(!Number.isInteger(seconds)||seconds<5||seconds>120)fail('Thời gian phải từ 5 đến 120 giây.');
      r.questions=custom;r.limit=seconds*1000;return json(res,{ok:true});
    }
    if(url.pathname==='/api/start'){
      if(!who.host)fail('Chỉ chủ phòng có thể bắt đầu.',403);
      if(r.phase!=='lobby')fail('Trận đấu đã bắt đầu.');if(!r.players.size)fail('Cần ít nhất một người chơi.');startQuestion(r,0);return json(res,{ok:true});
    }
    if(url.pathname==='/api/answer'){
      if(who.host)fail('Chủ phòng không thể trả lời trên màn hình này.',403);
      const now=Date.now();if(r.phase!=='question'||now>=r.endsAt||b.index!==r.index)fail('Câu hỏi đã hết thời gian.');
      if(!Number.isInteger(b.choice)||b.choice<0||b.choice>3)fail('Đáp án không hợp lệ.');
      const p=who.p;if(r.answers.has(p.id))fail('Bạn đã trả lời câu hỏi này.');
      const correct=b.choice===r.questions[r.index].correct;let points=0,speedRank=null;
      if(correct){speedRank=++r.correctRank;points=Math.max(100,1000-100*(speedRank-1));p.score+=points;p.correct++;p.totalTime+=now-r.startedAt;}
      r.answers.set(p.id,{choice:b.choice,correct,points,speedRank});if(r.answers.size===r.players.size)reveal(r,now);return json(res,{ok:true});
    }
    fail('API không tồn tại.',404);
  }
  const files={'/':'index.html','/index.html':'index.html','/style.css':'style.css','/app.js':'app.js'};
  const file=files[url.pathname];if(!file) return json(res,{error:'Không tìm thấy trang.'},404);
  const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8'};
  res.writeHead(200,{'Content-Type':types[path.extname(file)],'Cache-Control':'no-cache'});res.end(fs.readFileSync(path.join(__dirname,'public',file)));
 }catch(e){if(!res.headersSent)json(res,{error:e.status?e.message:'Máy chủ gặp lỗi.'},e.status||500);if(!e.status)console.error(e);}
});
setInterval(()=>{const now=Date.now();for(const [code,r] of rooms){if(now-r.created>12*3600_000)rooms.delete(code);else advance(r,now);}},150).unref();
server.listen(PORT,'0.0.0.0',()=>{console.log(`QuickQuiz: http://localhost:${PORT}`);addresses.forEach(a=>console.log('LAN: '+a));});
