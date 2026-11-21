const TG = "https://api.telegram.org/bot";
const h = e => ({apikey:e.SUPABASE_SERVICE_ROLE_KEY,"Content-Type":"application/json"});
async function db(e,t,q="",o={}){const r=await fetch(e.SUPABASE_URL+"/rest/v1/"+t+(q?"?"+q:""),{...o,headers:{...h(e),...(o.headers||{})}});const s=await r.text();if(!r.ok)throw Error(t+" "+r.status+" "+s.slice(0,400));return s?JSON.parse(s):[]}
async function tg(e,m,b){const r=await fetch(TG+e.BOT_TOKEN+"/"+m,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(b)});const j=await r.json();if(!j.ok)throw Error("Telegram "+j.description);return j.result}
const localDay=d=>{const x=new Date(d.getTime()+300000*60);return x.toISOString().slice(0,10)};
const norm=s=>String(s||"").toLocaleLowerCase("uz").replace(/[^\p{L}\p{N}]+/gu," ").trim();
async function question(e){
 const old=await db(e,"quizbot_questions","select=question_text&order=created_at.desc&limit=80");
 const cats=["Mantiq","Matematika","Tabiiy fanlar","Tarix","Geografiya","Til va adabiyot","Texnologiya","Umumiy bilim"],cat=cats[Math.floor(Math.random()*cats.length)];
 const prompt=`Sen professional o'zbek tilidagi intellektual Telegram shou muharririsan. Kategoriya: ${cat}. Oldingi savollarni takrorlama va ularga mazmunan juda o'xshash savol tuzma: ${JSON.stringify(old.map(x=>x.question_text))}. Kanal uchun odamni qiziqtiradigan, o'ylantiradigan, ravon va tabiiy savol yoz. Kirish jumlasini navbatma-navbat o'zgartir: "🧠 DIQQAT, BILIMDONLAR!", "🤔 BUNI TOPA OLASIZMI?", "🔎 QIZIQARLI SAVOL!", "⚡ TEZKOR BELLASHUV!" kabi; bir xil sarlavhani ketma-ket ishlatma. Savol aniq, fakt jihatdan ishonchli va faqat bitta shubhasiz to'g'ri javobga ega bo'lsin. 4 ta qisqa, bir-biridan farqli variant tuz; noto'g'ri variantlar ham ishonarli bo'lsin. Siyosiy targ'ibot, noaniq afsona, tekshirib bo'lmaydigan statistika va ikki xil talqin qilinadigan savollardan qoch. question maydonida Telegram postiga tayyor, 2-5 qatordan iborat chiroyli matn bo'lsin; javobni oshkor qilma. explanation maydonida to'g'ri javob sababini 2-3 qiziqarli gapda tushuntir. Faqat JSON qaytar: {"question":"...","options":["...","...","...","..."],"answer":"to'g'ri variant matni","explanation":"...","category":"...","difficulty":"easy|medium|hard"}`;
 const u="https://generativelanguage.googleapis.com/v1beta/models/"+(e.GEMINI_MODEL||"gemini-3.8-flash")+":generateContent?key="+e.GEMINI_API_KEY;
 const r=await fetch(u,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({contents:[{parts:[{text:prompt}]}],generationConfig:{responseMimeType:"application/json",temperature:.8}})});
 const j=await r.json();if(!r.ok)throw Error("Gemini "+JSON.stringify(j).slice(0,350));
 const raw=j.candidates?.[0]?.content?.parts?.map(p=>p.text||"").join("")||"",q=JSON.parse(raw.replace(/^```json\s*|\s*```$/g,"").trim());
 if(!q.question||!Array.isArray(q.options)||q.options.length!==4||new Set(q.options).size!==4||!q.options.includes(q.answer))throw Error("Gemini savol formati xato");
 const n=norm(q.question),words=new Set(n.split(" "));
 for(const x of old){const w=new Set(norm(x.question_text).split(" ")),same=[...words].filter(v=>w.has(v)).length/Math.max(1,new Set([...words,...w]).size);if(same>.84)throw Error("O'xshash savol qayta tekshiriladi")}
 const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(n)),hash=[...new Uint8Array(digest)].map(v=>v.toString(16).padStart(2,"0")).join("");
 const rows=await db(e,"quizbot_questions","on_conflict=content_hash",{method:"POST",headers:{"Prefer":"return=representation"},body:JSON.stringify({question_text:q.question,normalized_text:n,answer_text:q.answer,explanation:q.explanation||"",category:q.category||cat,difficulty:["easy","medium","hard"].includes(q.difficulty)?q.difficulty:"medium",options:q.options,content_hash:hash,status:"approved",source:"gemini"})});
 if(!rows.length)throw Error("Savol avval kiritilgan");return rows[0]
}
async function settings(e){return (await db(e,"quizbot_settings","id=eq.1&select=*"))[0]}
async function cron(e,now){
 const c=await settings(e);if(!c?.enabled)return;
 const day=localDay(now),begin=day+"T00:00:00%2B05:00";
 const found=await db(e,"quizbot_schedule","select=id,scheduled_at&scheduled_at=gte."+begin+"&limit=100");
 const count=found.filter(x=>x.scheduled_at.slice(0,10)===day || new Date(x.scheduled_at).toISOString().slice(0,10)===day).length;
 if(count<c.daily_question_count){
  const [a,b]=String(c.posting_window_start).slice(0,5).split(":").map(Number),[z,y]=String(c.posting_window_end).slice(0,5).split(":").map(Number),start=a*60+b,end=z*60+y,mins=new Set();
  while(mins.size<c.daily_question_count&&mins.size<end-start)mins.add(start+Math.floor(Math.random()*(end-start)));
  const rows=[...mins].sort((x,y)=>x-y).map(m=>({scheduled_at:new Date(Date.UTC(+day.slice(0,4),+day.slice(5,7)-1,+day.slice(8,10),Math.floor(m/60)-5,m%60)).toISOString(),status:"queued"}));
  if(rows.length)await db(e,"quizbot_schedule","on_conflict=scheduled_at",{method:"POST",headers:{"Prefer":"resolution=ignore-duplicates,return=minimal"},body:JSON.stringify(rows)});
 }
 const due=await db(e,"quizbot_schedule","select=*&status=eq.queued&scheduled_at=lte."+encodeURIComponent(now.toISOString())+"&order=scheduled_at.asc&limit=1");
 if(due.length){
  const s=due[0],claim=await db(e,"quizbot_schedule","id=eq."+s.id+"&status=eq.queued",{method:"PATCH",headers:{"Prefer":"return=representation"},body:JSON.stringify({status:"failed",error_text:"processing"})});
  if(claim.length)try{
   const q=await question(e);await db(e,"quizbot_schedule","id=eq."+s.id,{method:"PATCH",headers:{"Prefer":"return=minimal"},body:JSON.stringify({question_id:q.id})});
   const usePoll=Math.random()<0.5;
   let msg,pollId=null,postType="inline";
   if(usePoll){
    const correctIndex=q.options.indexOf(q.answer_text);
    msg=await tg(e,"sendPoll",{chat_id:c.channel_username,question:q.question_text.slice(0,300),options:q.options,type:"quiz",is_anonymous:true,correct_option_ids:[correctIndex],open_period:Math.max(5,Math.min(600,c.answer_delay_minutes*60)),hide_results_until_closes:true,explanation:(q.explanation||"Javob muddati tugagach to'g'ri javob e'lon qilinadi.").slice(0,200)});
    pollId=msg.poll?.id||null;postType="poll";
   }else{
    const keyboard={inline_keyboard:q.options.map((v,i)=>[{text:""+ "ABCD"[i]+". "+v,callback_data:"ans:"+q.id+":"+i}])};
    msg=await tg(e,"sendMessage",{chat_id:c.channel_username,text:"🧠 "+q.question_text+"\\n\\n⏳ Javob uchun "+c.answer_delay_minutes+" daqiqa!",reply_markup:keyboard});
   }
   await db(e,"quizbot_schedule","id=eq."+s.id,{method:"PATCH",headers:{"Prefer":"return=minimal"},body:JSON.stringify({status:"posted",telegram_message_id:msg.message_id,telegram_poll_id:pollId,post_type:postType,error_text:null})});
   await db(e,"quizbot_questions","id=eq."+q.id,{method:"PATCH",headers:{"Prefer":"return=minimal"},body:JSON.stringify({status:"posted",posted_at:now.toISOString()})});
  }catch(err){await db(e,"quizbot_schedule","id=eq."+s.id,{method:"PATCH",headers:{"Prefer":"return=minimal"},body:JSON.stringify({status:"queued",error_text:String(err).slice(0,800)})});console.error(err)}
 }
 const reveal=await db(e,"quizbot_schedule","select=*,quizbot_questions(*)&status=eq.posted&revealed_at=is.null&order=scheduled_at.asc&limit=8");
 for(const s of reveal){const q=s.quizbot_questions;if(!q?.posted_at||new Date(q.posted_at).getTime()>now.getTime()-c.answer_delay_minutes*60000)continue;
  try{const revealText="🏆 JAVOB E'LON QILINADI!\\n\\n🧠 "+q.question_text+"\\n\\n✅ To'g'ri javob: "+q.answer_text+"\\n\\n💡 Izoh: "+(q.explanation||"Qatnashganingiz uchun rahmat!");if(s.post_type==="poll")await tg(e,"sendMessage",{chat_id:c.channel_username,text:revealText});else await tg(e,"editMessageText",{chat_id:c.channel_username,message_id:s.telegram_message_id,text:revealText});await db(e,"quizbot_schedule","id=eq."+s.id+"&revealed_at=is.null",{method:"PATCH",headers:{"Prefer":"return=minimal"},body:JSON.stringify({revealed_at:now.toISOString()})})}catch(err){console.error("Reveal",err)}
 }
}
async function update(e,u){
 if(u.message){const m=u.message,v=m.from;if(m.text?.startsWith("/start")){await db(e,"quizbot_subscribers","on_conflict=telegram_user_id",{method:"POST",headers:{"Prefer":"resolution=merge-duplicates,return=minimal"},body:JSON.stringify({telegram_user_id:v.id,username:v.username||null,first_name:v.first_name||null,last_seen_at:new Date().toISOString()})});await db(e,"quizbot_growth_events","",{method:"POST",headers:{"Prefer":"return=minimal"},body:JSON.stringify({event_type:"start",telegram_user_id:v.id})});await tg(e,"sendMessage",{chat_id:m.chat.id,text:"Assalomu alaykum! 🧠 Bilimdon AI viktorinasiga xush kelibsiz. Kanalimiz: @universal_ai_quiz"})}
 else if(m.text?.startsWith("/leaderboard")){const r=await db(e,"quizbot_subscribers","select=username,first_name,score&order=score.desc,correct_answers.desc&limit=10");await tg(e,"sendMessage",{chat_id:m.chat.id,text:"🏆 TOP-10 BILIMDON\n\n"+(r.length?r.map((x,i)=>(i+1)+". "+(x.username?"@"+x.username:x.first_name||"Ishtirokchi")+" — "+x.score+" ball").join("\n"):"Hozircha natija yo'q")})}}
 if(u.callback_query){const c=u.callback_query,p=(c.data||"").split(":");if(p[0]!=="ans"||p.length!==3)return;const q=(await db(e,"quizbot_questions","id=eq."+p[1]+"&select=*"))[0],cfg=await settings(e),i=Number(p[2]);if(!q||!q.posted_at||Date.now()>=new Date(q.posted_at).getTime()+(cfg?.answer_delay_minutes||3)*60000){await tg(e,"answerCallbackQuery",{callback_query_id:c.id,text:"Javob vaqti tugadi",show_alert:true});return}if(!Number.isInteger(i)||i<0||i>3)return;
 const v=c.from,ok=q.options[i]===q.answer_text;await db(e,"quizbot_subscribers","on_conflict=telegram_user_id",{method:"POST",headers:{"Prefer":"resolution=merge-duplicates,return=minimal"},body:JSON.stringify({telegram_user_id:v.id,username:v.username||null,first_name:v.first_name||null,last_seen_at:new Date().toISOString()})});
 const ins=await db(e,"quizbot_answers","on_conflict=question_id,telegram_user_id",{method:"POST",headers:{"Prefer":"resolution=ignore-duplicates,return=representation"},body:JSON.stringify({question_id:q.id,telegram_user_id:v.id,answer_text:q.options[i],is_correct:ok})});
 if(ins.length){const s=(await db(e,"quizbot_subscribers","telegram_user_id=eq."+v.id+"&select=score,correct_answers,total_answers"))[0];if(s)await db(e,"quizbot_subscribers","telegram_user_id=eq."+v.id,{method:"PATCH",headers:{"Prefer":"return=minimal"},body:JSON.stringify({score:s.score+(ok?1:0),correct_answers:s.correct_answers+(ok?1:0),total_answers:s.total_answers+1})})}
 await tg(e,"answerCallbackQuery",{callback_query_id:c.id,text:ok?"To'g'ri! 🎉":"Javob qabul qilindi!",show_alert:true})
 }
}
export default {
 async fetch(req,e){const u=new URL(req.url);
 if(u.pathname==="/setup"&&req.method==="GET")return new Response(`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>Bilimdon webhook setup</title><main style="font:16px system-ui;max-width:520px;margin:40px auto;padding:20px"><h2>Bilimdon — Telegram ulash</h2><p>Cloudflare'da saqlagan TELEGRAM_WEBHOOK_SECRET qiymatini kiriting. Qiymat serverga HTTPS orqali yuboriladi.</p><form id="f"><input id="s" type="password" autocomplete="off" required placeholder="Webhook secret" style="box-sizing:border-box;width:100%;padding:12px"><button style="margin-top:12px;padding:12px">Telegram'ni ulash</button></form><pre id="r"></pre><script>document.getElementById('f').onsubmit=async ev=>{ev.preventDefault();const r=await fetch('/setup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({secret:document.getElementById('s').value})});document.getElementById('r').textContent=await r.text()}</script></main>`,{headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store"}});
 if(u.pathname==="/setup"&&req.method==="POST"){try{const b=await req.json();if(b.secret!==e.TELEGRAM_WEBHOOK_SECRET)return Response.json({ok:false,error:"Secret mos emas"},{status:401});const result=await tg(e,"setWebhook",{url:new URL("/telegram",u.origin).toString(),secret_token:e.TELEGRAM_WEBHOOK_SECRET,allowed_updates:["message","callback_query"]});return Response.json({ok:true,webhook_set:result})}catch(err){console.error(err);return Response.json({ok:false,error:String(err).slice(0,300)},{status:500})}}
 if(u.pathname==="/health")return Response.json({ok:true,service:"bilimdon"});if(u.pathname!=="/telegram"||req.method!=="POST")return new Response("Not found",{status:404});if(req.headers.get("X-Telegram-Bot-Api-Secret-Token")!==e.TELEGRAM_WEBHOOK_SECRET)return new Response("Unauthorized",{status:401});try{await update(e,await req.json());return Response.json({ok:true})}catch(err){console.error(err);return Response.json({ok:false},{status:500})}},
 async scheduled(event,e,ctx){ctx.waitUntil(cron(e,new Date(event.scheduledTime)))}
};