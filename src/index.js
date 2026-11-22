const TG = "https://api.telegram.org/bot";
const h = e => ({apikey:e.SUPABASE_SERVICE_ROLE_KEY,"Content-Type":"application/json"});
async function db(e,t,q="",o={}){const r=await fetch(e.SUPABASE_URL+"/rest/v1/"+t+(q?"?"+q:""),{...o,headers:{...h(e),...(o.headers||{})}});const s=await r.text();if(!r.ok)throw Error(t+" "+r.status+" "+s.slice(0,400));return s?JSON.parse(s):[]}
function escapeHtml(s){return String(s??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}
async function tg(e,m,b){const r=await fetch(TG+e.BOT_TOKEN+"/"+m,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(b)});const j=await r.json();if(!j.ok)throw Error("Telegram "+j.description);return j.result}
async function quizImage(e,q){
 if(!e.AI?.run)return null;
 const prompt="Create a high-quality photorealistic educational illustration for an Uzbek general-knowledge quiz. Visual topic only (do not reproduce these words): "+q.question_text+". Category: "+(q.category||"general")+". Show one clear visual scene or a few relevant physical objects as visual clues. Use a plain, uncluttered environment with blank surfaces. STRICT NEGATIVE RULE: the image must contain absolutely zero writing of any kind, including real or fake text, gibberish, letters, numbers, punctuation, symbols, captions, labels, logos, watermarks, signs, book pages, screens, maps with labels, license plates, or typography. Do not include books, documents, posters, packaging, storefronts, street signs, or visible screens. Do not depict the question or any answer option. Do not reveal the correct answer directly; use a neutral visual clue. No borders or graphic design. If the topic normally contains writing, represent it with physical objects instead. Make the image look like a real photograph, not a poster or infographic.";
 const out=await e.AI.run("@cf/black-forest-labs/flux-1-schnell",{prompt});
 if(out instanceof ArrayBuffer)return new Uint8Array(out);
 if(out instanceof Uint8Array)return out;
 if(out?.image instanceof Uint8Array)return out.image;
 if(typeof out?.image==="string"){const raw=atob(out.image);return Uint8Array.from(raw,c=>c.charCodeAt(0))}
 return null;
}
async function tgPhoto(e,chatId,caption,keyboard,bytes){
 const form=new FormData();form.append("chat_id",String(chatId));form.append("caption",caption);if(keyboard)form.append("reply_markup",JSON.stringify(keyboard));form.append("photo",new Blob([bytes],{type:"image/png"}),"quiz.png");
 const r=await fetch(TG+e.BOT_TOKEN+"/sendPhoto",{method:"POST",body:form});const j=await r.json();if(!j.ok)throw Error("Telegram "+j.description);return j.result
}
const localDay=d=>{const x=new Date(d.getTime()+300000*60);return x.toISOString().slice(0,10)};
const norm=s=>String(s||"").toLocaleLowerCase("uz").replace(/[^\p{L}\p{N}]+/gu," ").trim();
function modelText(v){
 if(typeof v==="string")return v;
 if(Array.isArray(v)){for(const x of v){const s=modelText(x);if(s)return s}return ""}
 if(v&&typeof v==="object"){
  for(const k of ["response","output_text","text","generated_text","content"]){if(v[k]!==undefined){const s=modelText(v[k]);if(s)return s}}
  if(v.question&&v.options)return JSON.stringify(v);
 }
 return "";
}
function parseQuestion(raw){
 const s=String(raw||"").trim().replace(/^\x60{3}(?:json)?\s*/i,"").replace(/\s*\x60{3}$/,"").trim();
 const a=s.indexOf("{"),b=s.lastIndexOf("}");
 if(a<0||b<a)throw Error("AI javobida JSON topilmadi");
 return JSON.parse(s.slice(a,b+1));
}
const categoryEmoji={"Mantiq":"🧩","Matematika":"🔢","Tabiiy fanlar":"🔬","Tarix":"🏛️","Geografiya":"🌍","Til va adabiyot":"📚","Texnologiya":"💻","Umumiy bilim":"🌟"};
async function question(e){
 const old=await db(e,"quizbot_questions","select=question_text&order=created_at.desc&limit=80");
 const cats=["Mantiq","Matematika","Tabiiy fanlar","Tarix","Geografiya","Til va adabiyot","Texnologiya","Umumiy bilim"],cat=cats[Math.floor(Math.random()*cats.length)];
 const prompt=`Sen professional o'zbek tilidagi intellektual Telegram shou muharririsan. Kategoriya: ${cat}. Oldingi savollarni takrorlama va ularga mazmunan juda o'xshash savol tuzma: ${JSON.stringify(old.map(x=>x.question_text))}. Kanal uchun odamni qiziqtiradigan, o'ylantiradigan, ravon va tabiiy savol yoz. Savol matnining boshiga mavzuga mos 1-2 emoji qo'sh (masalan 🧠 🤔 🌍 🔬 🏛️ 🚀 🐾 💡), emojilarni har safar almashtir; ortiqcha emoji bilan to'ldirma. Kirish jumlasini ham turlicha qil: "✨ BILIMDONLAR, DIQQAT!", "🤔 BUNI TOPA OLASIZMI?", "🔎 QIZIQARLI SAVOL!", "⚡ TEZKOR BELLASHUV!" kabi; bir xil sarlavhani ketma-ket ishlatma. Savol aniq, fakt jihatdan ishonchli va faqat bitta shubhasiz to'g'ri javobga ega bo'lsin. 4 ta qisqa, bir-biridan farqli variant tuz; noto'g'ri variantlar ham ishonarli bo'lsin. Siyosiy targ'ibot, noaniq afsona, tekshirib bo'lmaydigan statistika va ikki xil talqin qilinadigan savollardan qoch. question maydonida Telegram postiga tayyor, 2-5 qatordan iborat chiroyli matn bo'lsin; javobni oshkor qilma. explanation maydonida to'g'ri javob sababini 2-3 qiziqarli gapda tushuntir. Faqat JSON qaytar: {"question":"...","options":["...","...","...","..."],"answer":"to'g'ri variant matni","explanation":"...","category":"...","difficulty":"easy|medium|hard"}`;
 let raw="";
 if(e.AI?.run){
  const out=await e.AI.run("@cf/meta/llama-3.3-70b-instruct-fp8-fast",{messages:[{role:"system",content:"Sen professional o'zbek tilidagi intellektual viktorina muharririsan. Faqat so'ralgan JSON obyektini qaytar."},{role:"user",content:prompt}],response_format:{type:"json_object"},max_tokens:700,temperature:.8});
  raw=modelText(out);if(!raw)throw Error("Cloudflare AI javobi bo'sh");
 }else{
  const u="https://generativelanguage.googleapis.com/v1beta/models/"+(e.GEMINI_MODEL||"gemini-3.8-flash")+":generateContent?key="+e.GEMINI_API_KEY;
  const r=await fetch(u,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({contents:[{parts:[{text:prompt}]}],generationConfig:{responseMimeType:"application/json",temperature:.8}})});
  const j=await r.json();if(!r.ok)throw Error("Gemini "+JSON.stringify(j).slice(0,350));
  raw=j.candidates?.[0]?.content?.parts?.map(p=>p.text||"").join("")||"";
 }
 let q=parseQuestion(raw);
 // AI ba'zan javobni variant harfi yoki raqami, ba'zan esa to'liq matn ko'rinishida qaytaradi.
 if(!Array.isArray(q.options)&&q.options&&typeof q.options==="object")q.options=["A","B","C","D"].map(k=>q.options[k]??q.options[k.toLowerCase()]);
 if(Array.isArray(q.options))q.options=q.options.map(x=>typeof x==="string"?x:(x?.text??x?.value??x?.option??""));
 const answerRaw=q.answer??q.correct_answer??q.correct??q.correctAnswer??q.correct_option??q.correctOption??"";
 if(typeof q.question!=="string"||!q.question.trim()||q.question.length>3000||!Array.isArray(q.options)||q.options.length!==4||q.options.some(x=>typeof x!=="string"||!x.trim()||x.length>55)||new Set(q.options.map(x=>norm(x))).size!==4){
  console.error("AI question validation failed; raw:",String(raw).slice(0,1400));
  throw Error("AI savol formati xato: savol yoki 4 ta variant noto'g'ri");
 }
 const answerKey=String(answerRaw).trim(),letter=answerKey.match(/^([ABCD])(?:[.)\s:-]|$)/i),number=answerKey.match(/^([1-4])(?:[.)\s:-]|$)/);
 let answerIndex=Number.isInteger(q.answer_index)?q.answer_index:Number.isInteger(q.correct_option_index)?q.correct_option_index:-1;
 if(answerIndex<0||answerIndex>3)answerIndex=letter?"ABCD".indexOf(letter[1].toUpperCase()):number?Number(number[1])-1:-1;
 if(answerIndex<0)answerIndex=q.options.findIndex(x=>norm(x)===norm(answerKey));
 if(answerIndex<0&&answerRaw&&typeof answerRaw==="object")answerIndex=q.options.findIndex(x=>norm(x)===norm(answerRaw.text??answerRaw.value??answerRaw.option??""));
 if(answerIndex<0||answerIndex>3){
  console.error("AI answer mapping failed; answer:",JSON.stringify(answerRaw),"options:",JSON.stringify(q.options),"raw:",String(raw).slice(0,1400));
  throw Error("AI savol formati xato: to'g'ri javob 4 variantdan topilmadi");
 }
 q.question=q.question.trim();q.options=q.options.map(x=>x.trim());q.answer=q.options[answerIndex];
 const n=norm(q.question),words=new Set(n.split(" "));
 for(const x of old){const w=new Set(norm(x.question_text).split(" ")),same=[...words].filter(v=>w.has(v)).length/Math.max(1,new Set([...words,...w]).size);if(same>.84)throw Error("O'xshash savol qayta tekshiriladi")}
 const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(n)),hash=[...new Uint8Array(digest)].map(v=>v.toString(16).padStart(2,"0")).join("");
 const rows=await db(e,"quizbot_questions","on_conflict=content_hash",{method:"POST",headers:{"Prefer":"return=representation"},body:JSON.stringify({question_text:q.question,normalized_text:n,answer_text:q.answer,explanation:q.explanation||"",category:q.category||cat,difficulty:["easy","medium","hard"].includes(q.difficulty)?q.difficulty:"medium",options:q.options,content_hash:hash,status:"approved",source:"gemini"})});
 if(!rows.length)throw Error("Savol avval kiritilgan");return rows[0]
}
async function settings(e){return (await db(e,"quizbot_settings","id=eq.1&select=*"))[0]}
async function cron(e,now){
 const c=await settings(e);if(!c?.enabled)return;
 const local=new Date(now.getTime()+5*3600000),day=local.toISOString().slice(0,10),hh=local.getUTCHours(),mm=local.getUTCMinutes();
 const kind=hh===6&&mm>=39?'morning':mm===0&&hh===18?'evening':null;
 if(kind){
  const start=new Date(day+'T'+(kind==='morning'?'06:39:00':'18:00:00')+'+05:00'),end=new Date(start.getTime()+3600000),questionCount=25,sessionTitle=kind==='morning'?'KUNDUZGI':'KECHKI';
  let sess=(await db(e,'quizbot_sessions','on_conflict=session_date,session_type',{method:'POST',headers:{'Prefer':'resolution=ignore-duplicates,return=representation'},body:JSON.stringify({session_date:day,session_type:kind,starts_at:start.toISOString(),ends_at:end.toISOString(),status:'active'})}))[0];
  if(!sess)sess=(await db(e,'quizbot_sessions','session_date=eq.'+day+'&session_type=eq.'+kind+'&select=*'))[0];
  if(sess&&sess.status==='failed'){
   await db(e,'quizbot_sessions','id=eq.'+sess.id,{method:'PATCH',headers:{'Prefer':'return=minimal'},body:JSON.stringify({status:'active'})});
   sess.status='active';
  }
  if(sess&&sess.status==='active'){
   const prior=await db(e,'quizbot_schedule','session_id=eq.'+sess.id+'&select=id,question_id,question_number,status,telegram_message_id');
   const postedCount=prior.filter(x=>x.status==='posted').length;if(postedCount<questionCount)try{let postedThisRun=0;
    if(!prior.length)await tg(e,'sendMessage',{chat_id:c.channel_username,text:'🏆 BILIMDON — '+sessionTitle+' BELLASHUVI\n\n🧠 '+questionCount+' ta yangi savol!\n⏰ Javob berish uchun 1 soat vaqt.\n⚡ Har bir javobdan so‘ng natija darhol ko‘rsatiladi.'});
    for(let i=1;i<=questionCount;i++){
     if(postedThisRun>=5)break;
     const existing=prior.find(x=>Number(x.question_number)===i);
     if(existing?.status==='posted')continue;
     const q=existing?(await db(e,'quizbot_questions','id=eq.'+existing.question_id+'&select=*'))[0]:await question(e);
     let scheduleId=existing?.id;
     if(!existing){
      const scheduledAt=new Date(start.getTime()+(i-1)*1000).toISOString();
      const rows=await db(e,'quizbot_schedule','',{method:'POST',headers:{'Prefer':'return=representation'},body:JSON.stringify({session_id:sess.id,question_id:q.id,question_number:i,scheduled_at:scheduledAt,status:'queued'})});
      scheduleId=rows[0].id;
     }
     const answerIndex=q.options.findIndex(x=>x===q.answer_text);
     if(answerIndex<0)throw Error('Poll uchun to‘g‘ri javob varianti topilmadi');
     // Har uchinchi savolga rasmni alohida yuboramiz; javoblar Telegram Quiz Poll bo‘ladi.
     if(i%3===1){
      try{const bytes=await quizImage(e,q);if(bytes?.length)await tgPhoto(e,c.channel_username,'🌟 BILIMDON | '+sessionTitle+' — '+i+'/'+questionCount+'\n\n🖼️ Savolga oid rasm',null,bytes);}
      catch(imageErr){console.error('Quiz image failed; poll will be sent without image:',String(imageErr&&imageErr.message||imageErr));}
     }
     const pollQuestion=Array.from(q.question_text).slice(0,300).join('');
     const pollExplanation=Array.from(String(q.explanation||'')).slice(0,200).join('');
     const msg=await tg(e,'sendPoll',{chat_id:c.channel_username,question:pollQuestion,options:q.options,is_anonymous:false,type:'quiz',correct_option_ids:[answerIndex],explanation:pollExplanation,allows_multiple_answers:false,allows_revoting:false,close_date:Math.floor(end.getTime()/1000)});
     await db(e,'quizbot_schedule','id=eq.'+scheduleId,{method:'PATCH',headers:{'Prefer':'return=minimal'},body:JSON.stringify({status:'posted',telegram_message_id:msg.message_id,telegram_poll_id:msg.poll.id,post_type:'poll'})});
     await db(e,'quizbot_questions','id=eq.'+q.id,{method:'PATCH',headers:{'Prefer':'return=minimal'},body:JSON.stringify({status:'posted',posted_at:now.toISOString()})});
     postedThisRun++;
    }
   }catch(err){console.error('Session start failed: '+String(err&&err.message||err),err&&err.stack||'');await db(e,'quizbot_sessions','id=eq.'+sess.id,{method:'PATCH',headers:{'Prefer':'return=minimal'},body:JSON.stringify({status:'failed'})})}
  }
 }
 const due=await db(e,'quizbot_sessions','status=eq.active&ends_at=lte.'+encodeURIComponent(now.toISOString())+'&select=*');
 for(const s of due){
  const sched=await db(e,'quizbot_schedule','session_id=eq.'+s.id+'&select=question_id,question_number,revealed_at');
  const ids=sched.map(x=>x.question_id);if(!ids.length)continue;
  const ans=await db(e,'quizbot_answers','question_id=in.('+ids.join(',')+')&select=question_id,telegram_user_id,is_correct');
  const subs=await db(e,'quizbot_subscribers','select=telegram_user_id,username,first_name,score&order=score.desc&limit=1000');
  const participantIds=new Set(ans.map(x=>String(x.telegram_user_id)));const totals=subs.filter(u=>participantIds.has(String(u.telegram_user_id))).map(u=>{const mine=ans.filter(x=>String(x.telegram_user_id)===String(u.telegram_user_id));return {...u,correct:mine.filter(x=>x.is_correct).length,wrong:mine.filter(x=>!x.is_correct).length,unanswered:sched.length-mine.length};}).sort((x,y)=>y.correct-x.correct||x.wrong-y.wrong);
  for(let i=0;i<totals.length;i++){const u=totals[i];await db(e,'quizbot_session_results','on_conflict=session_id,telegram_user_id',{method:'POST',headers:{'Prefer':'resolution=merge-duplicates,return=minimal'},body:JSON.stringify({session_id:s.id,telegram_user_id:u.telegram_user_id,correct_count:u.correct,wrong_count:u.wrong,unanswered_count:u.unanswered,rank:i+1})});try{await tg(e,'sendMessage',{chat_id:u.telegram_user_id,text:'🏆 BILIMDON — NATIJA\n\n✅ To‘g‘ri: '+u.correct+'/'+sched.length+'\n❌ Noto‘g‘ri: '+u.wrong+'\n⌛ Javobsiz: '+u.unanswered+'\n📊 Reyting: '+(i+1)+'/'+totals.length+'\n\nKeyingi bellashuvda omad!'});}catch(err){console.error('Result DM',u.telegram_user_id,err)}}
  let answerText='📚 TO‘G‘RI JAVOBLAR VA IZOHLAR\n\n';
  for(const r of sched){const q=(await db(e,'quizbot_questions','id=eq.'+r.question_id+'&select=answer_text,explanation'))[0];if(q)answerText+=r.question_number+'. '+q.answer_text+' — '+q.explanation+'\n\n';}
  const chunks=[];let chunk='';for(const part of answerText.split('\n\n')){const next=chunk?(chunk+'\n\n'+part):part;if(next.length>3900&&chunk){chunks.push(chunk);chunk=part;}else chunk=next;}if(chunk)chunks.push(chunk);
  if(!sched.every(r=>r.revealed_at)){for(const part of chunks)await tg(e,'sendMessage',{chat_id:c.channel_username,text:part});await db(e,'quizbot_schedule','session_id=eq.'+s.id+'&revealed_at=is.null',{method:'PATCH',headers:{'Prefer':'return=minimal'},body:JSON.stringify({revealed_at:now.toISOString()})});}
  const participants=[...new Set(ans.map(x=>String(x.telegram_user_id)))];
  for(const uid of participants){for(const part of chunks){try{await tg(e,'sendMessage',{chat_id:Number(uid),text:part});}catch(err){console.error('Answers DM',uid,err);break;}}}
  await db(e,'quizbot_sessions','id=eq.'+s.id,{method:'PATCH',headers:{'Prefer':'return=minimal'},body:JSON.stringify({status:'finished',finished_at:now.toISOString()})});
 }
 // Send reminders every two hours only to users who previously started the bot.
 const l=new Date(now.getTime()+5*3600000);if(l.getUTCMinutes()===0&&l.getUTCHours()%2===0){const cutoff=new Date(now.getTime()-7200000).toISOString(),slot=new Date(Math.floor(now.getTime()/7200000)*7200000).toISOString();const users=await db(e,'quizbot_subscribers','last_seen_at=lt.'+encodeURIComponent(cutoff)+'&select=telegram_user_id,score&limit=500');for(const u of users){const seen=await db(e,'quizbot_reminder_log','telegram_user_id=eq.'+u.telegram_user_id+'&reminder_slot=eq.'+encodeURIComponent(slot)+'&select=id');if(!seen.length)try{await tg(e,'sendMessage',{chat_id:u.telegram_user_id,text:'🔔 BILIMDON eslatadi!\n🏆 Umumiy ballingiz: '+u.score+'\nYangi bellashuvlarni o‘tkazib yubormang: @universal_ai_quiz'});await db(e,'quizbot_reminder_log','',{method:'POST',headers:{'Prefer':'return=minimal'},body:JSON.stringify({telegram_user_id:u.telegram_user_id,reminder_slot:slot})});}catch(err){console.error('Reminder',err)}}}
}
async function update(e,u){
 if(u.poll_answer){
  const pa=u.poll_answer;
  if(!pa.user||!Array.isArray(pa.option_ids)||!pa.option_ids.length)return;
  const mapped=await db(e,'quizbot_schedule','telegram_poll_id=eq.'+encodeURIComponent(pa.poll_id)+'&select=question_id,session_id&limit=1');
  if(!mapped.length)return;
  const sess=(await db(e,'quizbot_sessions','id=eq.'+mapped[0].session_id+'&select=status,ends_at'))[0];
  if(!sess||sess.status!=='active'||Date.now()>=new Date(sess.ends_at).getTime())return;
  await db(e,'rpc/submit_quiz_answer','',{method:'POST',body:JSON.stringify({p_question_id:mapped[0].question_id,p_telegram_user_id:pa.user.id,p_option_index:pa.option_ids[0],p_username:pa.user.username||null,p_first_name:pa.user.first_name||null})});
  return;
 }
 if(u.message){const m=u.message,v=m.from;if(m.text?.startsWith("/start")){await db(e,"quizbot_subscribers","on_conflict=telegram_user_id",{method:"POST",headers:{"Prefer":"resolution=merge-duplicates,return=minimal"},body:JSON.stringify({telegram_user_id:v.id,username:v.username||null,first_name:v.first_name||null,last_seen_at:new Date().toISOString()})});await db(e,"quizbot_growth_events","",{method:"POST",headers:{"Prefer":"return=minimal"},body:JSON.stringify({event_type:"start",telegram_user_id:v.id})});await tg(e,"sendMessage",{chat_id:m.chat.id,text:"🏆 <b>BILIMDON AI</b> — <b>INTELLEKTUAL SHOU</b>\n\nAssalomu alaykum, "+escapeHtml(v.first_name||"Bilimdon")+"! 👋\n\n🧠 Bilimingizni sinang, yangi savollarga javob bering va TOP-10 reytingida yuqorilang!\n\n<b>🎯 Bellashuvlar:</b> har kuni 06:39 va 18:00\n<b>📝 Har bir bellashuv:</b> 25 ta savol\n<b>🏅 Ball:</b> har bir to‘g‘ri javob uchun 1 ball\n\nQuyidagi menyudan kerakli bo‘limni tanlang:",parse_mode:"HTML",reply_markup:{inline_keyboard:[[{text:"👤 Mening profilim",callback_data:"menu:profile"},{text:"🏆 Reyting",callback_data:"menu:leaderboard"}],[{text:"📅 Bellashuv jadvali",callback_data:"menu:schedule"},{text:"📊 Natijalarim",callback_data:"menu:results"}],[{text:"📖 Qoidalar",callback_data:"menu:rules"},{text:"📢 Viktorina kanali",url:"https://t.me/universal_ai_quiz"}]]}})}
 else if(m.text?.startsWith("/leaderboard")){const r=await db(e,"quizbot_subscribers","select=username,first_name,score&order=score.desc,correct_answers.desc&limit=10");await tg(e,"sendMessage",{chat_id:m.chat.id,text:"🏆 TOP-10 BILIMDON\n\n"+(r.length?r.map((x,i)=>(i+1)+". "+(x.username?"@"+x.username:x.first_name||"Ishtirokchi")+" — "+x.score+" ball").join("\n"):"Hozircha natija yo'q")})}}
 if(u.message){const m=u.message,origin=m.reply_to_message?.forward_origin;if(origin?.type==="channel"&&!m.from?.is_bot&&(m.text||m.caption)){const linked=await db(e,"quizbot_schedule","select=question_id&telegram_message_id=eq."+origin.message_id+"&limit=1");if(linked.length){await db(e,"quizbot_discussion_answers","",{method:"POST",headers:{"Prefer":"resolution=ignore-duplicates,return=minimal"},body:JSON.stringify({question_id:linked[0].question_id,telegram_message_id:m.message_id,telegram_user_id:m.from.id,username:m.from.username||null,first_name:m.from.first_name||null,answer_text:(m.text||m.caption).slice(0,4000)})});await tg(e,"sendMessage",{chat_id:m.chat.id,text:"💬 Javobingiz qabul qilindi! Ishtirokingiz uchun rahmat.",reply_to_message_id:m.message_id})}}}
 if(u.callback_query){const c=u.callback_query,p=(c.data||'').split(':');
 if(p[0]==='menu'){
  const uid=c.from.id,first=escapeHtml(c.from.first_name||"Bilimdon");
  await tg(e,'answerCallbackQuery',{callback_query_id:c.id});
  if(p[1]==='profile'){
   const me=(await db(e,'quizbot_subscribers','telegram_user_id=eq.'+uid+'&select=*'))[0]||{};
   const a=await db(e,'quizbot_answers','telegram_user_id=eq.'+uid+'&select=is_correct');
   const good=a.filter(x=>x.is_correct).length;
   const text='👤 <b>MENING PROFILIM</b>\n\nSalom, '+first+'! 🌟\n🏅 Umumiy ball: <b>'+(me.score||0)+'</b>\n✅ To‘g‘ri javoblar: <b>'+good+'</b>\n📝 Javoblar soni: <b>'+a.length+'</b>\n\nHar bir bellashuvda faol qatnashing!';
   await tg(e,'sendMessage',{chat_id:uid,text,parse_mode:'HTML'});
  }else if(p[1]==='leaderboard'){
   const r=await db(e,'quizbot_subscribers','select=username,first_name,score&order=score.desc,correct_answers.desc&limit=10');
   await tg(e,'sendMessage',{chat_id:uid,text:'🏆 <b>TOP-10 BILIMDON</b>\n\n'+(r.length?r.map((x,i)=>(i+1)+'. '+(x.username?'@'+x.username:x.first_name||'Ishtirokchi')+' — '+x.score+' ball').join('\n'):'Hozircha natija yo‘q'),parse_mode:'HTML'});
  }else if(p[1]==='schedule'){
   await tg(e,'sendMessage',{chat_id:uid,text:'📅 <b>BELLASHUV JADVALI</b>\n\n🌅 Ertalabgi bellashuv — <b>06:39</b>\n🌆 Kechki bellashuv — <b>18:00</b>\n🧠 Har birida 25 ta savol\n⏳ Javob berish uchun 1 soat\n\nBarcha vaqtlar Toshkent vaqti bilan.' ,parse_mode:'HTML'});
  }else if(p[1]==='results'){
   let rows=[];
   try{rows=await db(e,'quizbot_session_results','telegram_user_id=eq.'+uid+'&select=correct_count,wrong_count,unanswered_count,rank,session_id&order=created_at.desc&limit=5');}
   catch(err){console.error('Results menu error',err);}
   await tg(e,'sendMessage',{chat_id:uid,text:'📊 <b>SO‘NGGI NATIJALARIM</b>\n\n'+(rows.length?rows.map((x,i)=>(i+1)+'. ✅ '+x.correct_count+'/25  | 🏆 '+x.rank+'-o‘rin').join('\n'):'Hali yakunlangan bellashuv natijalari yo‘q. Birinchi bellashuvda qatnashing!'),parse_mode:'HTML'});
  }else if(p[1]==='rules'){
   await tg(e,'sendMessage',{chat_id:uid,text:'📖 BELLASHUV QOIDALARI\n\n1️⃣ Har bir bellashuvda 25 ta savol beriladi.\n2️⃣ Javob berish vaqti — 1 soat.\n3️⃣ Har bir savolga faqat bir marta javob berish mumkin.\n4️⃣ Javobni o‘zgartirib bo‘lmaydi.\n5️⃣ To‘g‘ri javob — 1 ball.\n6️⃣ Javobni tanlaganingiz zahoti to‘g‘ri yoki noto‘g‘ri ekanini bilasiz.\n7️⃣ Yakuniy natija va reyting shaxsiy xabarda yuboriladi.\n\n🤝 Halol bellashing va bilim bilan g‘alaba qozoning!'});
  }
  return;
 }
 if(p[0]!=='ans'||p.length!==3)return;const q=(await db(e,'quizbot_questions','id=eq.'+p[1]+'&select=*'))[0],i=Number(p[2]);if(!q||!Number.isInteger(i)||i<0||i>3)return;
 const sch=(await db(e,'quizbot_schedule','question_id=eq.'+q.id+'&select=session_id'))[0],sess=sch?.session_id?(await db(e,'quizbot_sessions','id=eq.'+sch.session_id+'&select=*'))[0]:null;
 if(!sess||sess.status!=='active'||Date.now()>=new Date(sess.ends_at).getTime()){await tg(e,'answerCallbackQuery',{callback_query_id:c.id,text:'Bellashuv vaqti tugadi.',show_alert:true});return;}
 const v=c.from,result=(await db(e,'rpc/submit_quiz_answer','',{method:'POST',body:JSON.stringify({p_question_id:q.id,p_telegram_user_id:v.id,p_option_index:i,p_username:v.username||null,p_first_name:v.first_name||null})}))[0];
 if(!result?.inserted){await tg(e,'answerCallbackQuery',{callback_query_id:c.id,text:'Bu savolga avval javob bergansiz.',show_alert:true});return;}
 const feedback=result.is_correct?'✅ To‘g‘ri javob! +1 ball.':'❌ Noto‘g‘ri javob. To‘g‘ri javob: '+result.correct_answer;await tg(e,'answerCallbackQuery',{callback_query_id:c.id,text:feedback.slice(0,190),show_alert:true});
 }
}
export default {
 async fetch(req,e){const u=new URL(req.url);
 if(u.pathname==="/setup"&&req.method==="GET")return new Response(`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>Bilimdon webhook setup</title><main style="font:16px system-ui;max-width:520px;margin:40px auto;padding:20px"><h2>Bilimdon — Telegram ulash</h2><p>Cloudflare'da saqlagan TELEGRAM_WEBHOOK_SECRET qiymatini kiriting. Qiymat serverga HTTPS orqali yuboriladi.</p><form id="f"><input id="s" type="password" autocomplete="off" required placeholder="Webhook secret" style="box-sizing:border-box;width:100%;padding:12px"><button style="margin-top:12px;padding:12px">Telegram'ni ulash</button></form><pre id="r"></pre><script>document.getElementById('f').onsubmit=async ev=>{ev.preventDefault();const r=await fetch('/setup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({secret:document.getElementById('s').value})});document.getElementById('r').textContent=await r.text()}</script></main>`,{headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store"}});
 if(u.pathname==="/setup"&&req.method==="POST"){try{const b=await req.json();if(b.secret!==e.TELEGRAM_WEBHOOK_SECRET)return Response.json({ok:false,error:"Secret mos emas"},{status:401});const result=await tg(e,"setWebhook",{url:new URL("/telegram",u.origin).toString(),secret_token:e.TELEGRAM_WEBHOOK_SECRET,allowed_updates:["message","callback_query","poll_answer"]});return Response.json({ok:true,webhook_set:result})}catch(err){console.error(err);return Response.json({ok:false,error:String(err).slice(0,300)},{status:500})}}
 if(u.pathname==="/health")return Response.json({ok:true,service:"bilimdon"});if(u.pathname!=="/telegram"||req.method!=="POST")return new Response("Not found",{status:404});if(req.headers.get("X-Telegram-Bot-Api-Secret-Token")!==e.TELEGRAM_WEBHOOK_SECRET)return new Response("Unauthorized",{status:401});try{await update(e,await req.json());return Response.json({ok:true})}catch(err){console.error(err);return Response.json({ok:false},{status:500})}},
 async scheduled(event,e,ctx){ctx.waitUntil(cron(e,new Date(event.scheduledTime)))}
};