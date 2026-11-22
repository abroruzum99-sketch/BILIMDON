const TG = "https://api.telegram.org/bot";
const h = e => ({apikey:e.SUPABASE_SERVICE_ROLE_KEY,"Content-Type":"application/json"});
async function db(e,t,q="",o={}){const r=await fetch(e.SUPABASE_URL+"/rest/v1/"+t+(q?"?"+q:""),{...o,headers:{...h(e),...(o.headers||{})}});const s=await r.text();if(!r.ok)throw Error(t+" "+r.status+" "+s.slice(0,400));return s?JSON.parse(s):[]}
function escapeHtml(s){return String(s??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}
async function tg(e,m,b){const r=await fetch(TG+e.BOT_TOKEN+"/"+m,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(b)});const j=await r.json();if(!j.ok)throw Error("Telegram "+j.description);return j.result}
async function quizImage(e,q){
 const prompt="Create a high-quality photorealistic educational illustration for an Uzbek general-knowledge quiz. Visual topic only (do not reproduce these words): "+q.question_text+". Category: "+(q.category||"general")+". Show one clear visual scene or a few relevant physical objects as visual clues. Use a plain, uncluttered environment with blank surfaces. STRICT NEGATIVE RULE: the image must contain absolutely zero writing of any kind, including real or fake text, gibberish, letters, numbers, punctuation, symbols, captions, labels, logos, watermarks, signs, book pages, screens, maps with labels, license plates, or typography. Do not include books, documents, posters, packaging, storefronts, street signs, or visible screens. Do not depict the question or any answer option. Do not reveal the correct answer directly; use a neutral visual clue. No borders or graphic design. If the topic normally contains writing, represent it with physical objects instead. Make the image look like a real photograph, not a poster or infographic.";
 // Gemini image modeli faqat alohida sozlanganda ishlaydi: u pullik tarif talab qilishi mumkin.
 if(e.GEMINI_API_KEY&&e.GEMINI_IMAGE_MODEL){
  const model=e.GEMINI_IMAGE_MODEL,u="https://generativelanguage.googleapis.com/v1beta/models/"+model+":generateContent";
  const r=await fetch(u,{method:"POST",headers:{"Content-Type":"application/json","x-goog-api-key":e.GEMINI_API_KEY},body:JSON.stringify({contents:[{parts:[{text:prompt}]}],generationConfig:{responseModalities:["IMAGE"],imageConfig:{aspectRatio:"4:3",imageSize:"1K"}}})});
  const j=await r.json();if(!r.ok)throw Error("Gemini image "+JSON.stringify(j).slice(0,350));
  for(const part of j.candidates?.[0]?.content?.parts||[]){
   const data=part.inlineData||part.inline_data;
   if(data?.data){const raw=atob(data.data);return {bytes:Uint8Array.from(raw,x=>x.charCodeAt(0)),mimeType:data.mimeType||data.mime_type||"image/png"}}
  }
  throw Error("Gemini image javobida rasm topilmadi");
 }
 // Agar alohida Gemini image modeli sozlanmagan bo'lsa, Cloudflare image generatori sinab ko'riladi.
 if(!e.AI?.run)return null;
 const out=await e.AI.run("@cf/black-forest-labs/flux-1-schnell",{prompt});
 if(out instanceof ArrayBuffer)return {bytes:new Uint8Array(out),mimeType:"image/png"};
 if(out instanceof Uint8Array)return {bytes:out,mimeType:"image/png"};
 if(out?.image instanceof Uint8Array)return {bytes:out.image,mimeType:"image/png"};
 if(typeof out?.image==="string"){const raw=atob(out.image);return {bytes:Uint8Array.from(raw,x=>x.charCodeAt(0)),mimeType:"image/png"}}
 return null;
}
async function tgPhoto(e,chatId,caption,keyboard,image){
 const form=new FormData();form.append("chat_id",String(chatId));form.append("caption",caption);if(keyboard)form.append("reply_markup",JSON.stringify(keyboard));form.append("photo",new Blob([image.bytes],{type:image.mimeType||"image/png"}),image.mimeType==="image/jpeg"?"quiz.jpg":"quiz.png");
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
async function generateQuestionBatch(e,count=5){
 const old=await db(e,"quizbot_questions","select=question_text&order=created_at.desc&limit=100");
 const cats=["Mantiq","Matematika","Tabiiy fanlar","Tarix","Geografiya","Til va adabiyot","Texnologiya","Umumiy bilim"];
 const prompt=`Sen professional o'zbek tilidagi intellektual viktorina muharririsan. Bir-biridan farqli, fakt jihatdan ishonchli va qiziqarli ${count} ta yangi savol yarat. Oldingi savollarni takrorlama: ${JSON.stringify(old.map(x=>x.question_text))}. Kategoriyalarni aralashtir: ${cats.join(", ")}. Har savolga 4 ta qisqa va farqli variant, faqat bitta shubhasiz to'g'ri javob, 2-3 gapli izoh ber. Savol matni ravon o'zbek tilida, Telegramga tayyor bo'lsin; boshida mavzuga mos 1-2 emoji bo'lsin. Variantlar 55 belgidan oshmasin. Javob maydonida to'g'ri variantning aynan to'liq matnini yoz. Har bir obyekt shakli: {"question":"...","options":["...","...","...","..."],"answer":"variant matni","explanation":"...","category":"...","difficulty":"easy|medium|hard"}. Faqat JSON qaytar: {"questions":[...]}.`;
 let raw="",geminiError=null,cloudflareError=null;
 if(e.GEMINI_API_KEY){
  try{
   const model=e.GEMINI_MODEL||"gemini-3.8-flash",u="https://generativelanguage.googleapis.com/v1beta/models/"+model+":generateContent";
   const r=await fetch(u,{method:"POST",headers:{"Content-Type":"application/json","x-goog-api-key":e.GEMINI_API_KEY},body:JSON.stringify({contents:[{parts:[{text:prompt}]}],generationConfig:{responseMimeType:"application/json",maxOutputTokens:8192,thinkingConfig:{thinkingLevel:"LOW"}}})});
   const j=await r.json();if(!r.ok)throw Error("Gemini "+JSON.stringify(j).slice(0,500));
   raw=j.candidates?.[0]?.content?.parts?.map(p=>p.text||"").join("")||"";if(!raw)throw Error("Gemini batch javobi bo'sh");
  }catch(err){geminiError=err;console.error("Gemini batch xatosi:",String(err?.message||err));}
 }
 if(!raw&&e.AI?.run){
  try{
   const out=await e.AI.run("@cf/meta/llama-3.3-70b-instruct-fp8-fast",{messages:[{role:"system",content:"Faqat JSON formatda savollar massivini qaytaradigan o'zbek viktorina muharririsan."},{role:"user",content:prompt}],response_format:{type:"json_object"},max_tokens:8192});
   raw=modelText(out);if(!raw)throw Error("Cloudflare AI batch javobi bo'sh");
  }catch(err){cloudflareError=err;console.error("Cloudflare batch fallback xatosi:",String(err?.message||err));}
 }
 if(!raw)throw Error("5 talik savol paketi yaratilmadi. Gemini: "+String(geminiError?.message||"kalit yo'q")+"; Cloudflare AI: "+String(cloudflareError?.message||"mavjud emas"));
 const parsed=parseQuestion(raw),items=Array.isArray(parsed)?parsed:parsed.questions;
 if(!Array.isArray(items)||items.length<count)throw Error("AI batch javobida "+count+" ta savol yo'q");
 const rows=[];
 for(const q of items.slice(0,count)){
  if(!q||typeof q.question!=="string"||!q.question.trim()||!Array.isArray(q.options)||q.options.length!==4)throw Error("Batch savol formati noto'g'ri");
  const options=q.options.map(x=>typeof x==="string"?x:(x?.text??x?.value??"")).map(x=>String(x).trim());
  if(options.some(x=>!x||x.length>55)||new Set(options.map(norm)).size!==4)throw Error("Batch variantlari noto'g'ri");
  const answer=String(q.answer??q.correct_answer??"").trim(),letter=answer.match(/^([ABCD])(?:[.)\s:-]|$)/i),number=answer.match(/^([1-4])(?:[.)\s:-]|$)/);
  let idx=Number.isInteger(q.answer_index)?q.answer_index:letter?"ABCD".indexOf(letter[1].toUpperCase()):number?Number(number[1])-1:options.findIndex(x=>norm(x)===norm(answer));
  if(idx<0||idx>3)throw Error("Batch to'g'ri javobi variantlarga mos emas");
  const text=q.question.trim(),n=norm(text),digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(n)),hash=[...new Uint8Array(digest)].map(v=>v.toString(16).padStart(2,"0")).join("");
  const inserted=await db(e,"quizbot_questions","on_conflict=content_hash",{method:"POST",headers:{"Prefer":"return=representation"},body:JSON.stringify({question_text:text,normalized_text:n,answer_text:options[idx],explanation:String(q.explanation||""),category:String(q.category||"Umumiy bilim"),difficulty:["easy","medium","hard"].includes(q.difficulty)?q.difficulty:"medium",options,content_hash:hash,status:"approved",source:"gemini_batch"})});
  if(inserted.length)rows.push(inserted[0]);
 }
 if(rows.length<count)throw Error("Batchdan faqat "+rows.length+"/"+count+" ta yangi savol saqlandi (takroriy savollar chiqarib tashlandi)");
 return rows;
}
const BUILTIN_QUESTIONS=[
["🌍 Yer yuzidagi eng katta okean qaysi? ",["Atlantika","Hind","Tinch","Shimoliy Muz"],2,"Tinch okeani maydoni bo'yicha dunyodagi eng katta okean. U Yer yuzasining katta qismini egallaydi.","Geografiya"],
["🔬 O'simliklar fotosintez jarayonida asosan qaysi gazni yutadi?",["Kislorod","Karbonat angidrid","Azot","Vodorod"],1,"Fotosintezda o'simliklar karbonat angidrid va suvdan foydalanib organik modda hosil qiladi, kislorod ajratadi.","Tabiiy fanlar"],
["🏛️ Amir Temur davlatining poytaxti qaysi shahar bo'lgan?",["Buxoro","Samarqand","Xiva","Toshkent"],1,"Amir Temur Samarqandni o'z saltanatining poytaxtiga aylantirgan va uni yirik markaz sifatida rivojlantirgan.","Tarix"],
["🧠 Bir kilogramm paxta og'irmi yoki bir kilogramm temir?",["Paxta","Temir","Ikkalasi teng","Hajmiga bog'liq"],2,"Massa ikkalasida ham bir kilogramm. Moddalar zichligi turlicha bo'lgani uchun hajmi farq qiladi.","Mantiq"],
["🔢 12 ning kvadrati nechaga teng?",["124","144","122","164"],1,"Sonning kvadrati uni o'ziga ko'paytirishdir: 12 × 12 = 144.","Matematika"],
["📚 'Xamsa' asarining muallifi kim?",["Zahiriddin Bobur","Alisher Navoiy","Ahmad Yassaviy","Abdulla Qodiriy"],1,"Alisher Navoiy turkiy tilda yozilgan mashhur 'Xamsa' dostonlar majmuasini yaratgan.","Til va adabiyot"],
["🚀 Quyosh sistemasidagi eng katta sayyora qaysi?",["Saturn","Yer","Yupiter","Neptun"],2,"Yupiter Quyosh sistemasidagi eng katta sayyora bo'lib, gaz gigantlari turkumiga kiradi.","Tabiiy fanlar"],
["🗺️ O'zbekiston nechta davlat bilan chegaradosh?",["4 ta","5 ta","6 ta","7 ta"],1,"O'zbekiston Qozog'iston, Qirg'iziston, Tojikiston, Afg'oniston va Turkmaniston bilan chegaradosh.","Geografiya"],
["⚡ Elektr tok kuchining SI tizimidagi birligi nima?",["Volt","Vatt","Amper","Om"],2,"Tok kuchi amperda o'lchanadi. Volt kuchlanish, vatt esa quvvat birligidir.","Tabiiy fanlar"],
["🌙 Yerning tabiiy yo'ldoshi nima?",["Mars","Oy","Quyosh","Venera"],1,"Oy Yerning yagona tabiiy yo'ldoshi bo'lib, Yer atrofida aylanadi.","Tabiiy fanlar"],
["🧩 Qaysi son tub son hisoblanadi?",["21","27","29","33"],2,"29 faqat 1 ga va o'ziga bo'linadi. Shu sababli u tub son hisoblanadi.","Matematika"],
["🏺 Qadimgi Misr yozuvi qanday nomlangan?",["Mixxat","Iyeroglif","Lotin yozuvi","Run yozuvi"],1,"Qadimgi misrliklar rasmsimon belgilar tizimi — iyerogliflardan foydalangan.","Tarix"],
["💻 Kompyuterning asosiy hisoblash va boshqarish qurilmasi qaysi?",["Monitor","Klaviatura","Protsessor","Printer"],2,"Protsessor buyruqlarni bajaradi va kompyuter ishini boshqaradi.","Texnologiya"],
["🌡️ Suv normal atmosfera bosimida necha °C da qaynaydi?",["0","50","100","120"],2,"Dengiz sathiga yaqin normal atmosfera bosimida suv 100 °C da qaynaydi.","Tabiiy fanlar"],
["📖 O'zbek tilida nechta unli harf bor?",["5 ta","6 ta","7 ta","8 ta"],1,"Amaldagi o'zbek lotin alifbosida olti unli harf bor: a, e, i, o, u, o'.","Til va adabiyot"],
["🌌 Somon yo'li nima?",["Sayyora","Yulduz turkumi","Galaktika","Tumanlik"],2,"Somon yo'li Quyosh sistemasi joylashgan galaktika hisoblanadi.","Tabiiy fanlar"],
["🏆 Bir asr necha yilga teng?",["10 yil","50 yil","100 yil","1000 yil"],2,"Bir asr yuz yilni tashkil etadi.","Umumiy bilim"],
["🧮 3, 6, 12, 24 ketma-ketligidagi keyingi son qaysi?",["30","36","48","42"],2,"Har bir keyingi son avvalgisidan ikki baravar katta: 24 × 2 = 48.","Mantiq"],
["🌊 Dunyodagi eng baland tog' cho'qqisi qaysi?",["K2","Everest","Kilimanjaro","Elbrus"],1,"Everest dengiz sathidan taxminan 8 849 metr baland bo'lib, dunyodagi eng baland cho'qqidir.","Geografiya"],
["🧬 Inson tanasida qonni haydaydigan a'zo qaysi?",["O'pka","Jigar","Yurak","Buyrak"],2,"Yurak qisqarib-bo'shashish orqali qonni qon tomirlari bo'ylab harakatlantiradi.","Tabiiy fanlar"],
["🎨 Ranglar spektrida kamalakning odatiy tartibida yashildan keyin qaysi rang keladi?",["Sariq","Ko'k","Qizil","Binafsha"],1,"Kamalak ranglari odatda qizil, zarg'aldoq, sariq, yashil, havorang, ko'k va binafsha tartibida sanaladi.","Umumiy bilim"],
["📐 To'g'ri burchak necha gradus?",["45°","90°","120°","180°"],1,"To'g'ri burchakning o'lchovi 90 gradusga teng.","Matematika"],
["🌿 Choyning vatani sifatida ko'pincha qaysi mamlakat ko'rsatiladi?",["Xitoy","Braziliya","Misr","Norvegiya"],0,"Choy o'simligidan foydalanish va uni yetishtirish tarixi qadimgi Xitoy bilan chambarchas bog'liq.","Umumiy bilim"],
["🛰️ GPS tizimi asosan nima uchun ishlatiladi?",["Rasm chizish","Joylashuvni aniqlash","Matn tarjimasi","Ovoz yozish"],1,"GPS sun'iy yo'ldosh signallari yordamida qurilmaning geografik joylashuvini aniqlashga yordam beradi.","Texnologiya"],
["🏛️ BMT qaysi yilda tashkil etilgan?",["1919","1945","1955","1961"],1,"Birlashgan Millatlar Tashkiloti 1945-yil 24-oktabrda rasman tashkil topgan.","Tarix"],
["🏔️ Dunyodagi eng uzun quruqlikdagi tog' tizmasi qaysi?",["And tog'lari","Himolay","Alp tog'lari","Ural"],0,"And tog'lari Janubiy Amerikaning g'arbiy chekkasi bo'ylab minglab kilometrga cho'zilgan.","Geografiya"],
["🧪 Osh tuzining kimyoviy formulasi qaysi?",["H2O","CO2","NaCl","O2"],2,"Osh tuzi natriy va xlor ionlaridan tashkil topgan natriy xloriddir.","Tabiiy fanlar"],
["📅 Kabisa yilida necha kun bo'ladi?",["364","365","366","367"],2,"Kabisa yilida fevral 29 kun bo'ladi va yil jami 366 kunni tashkil etadi.","Umumiy bilim"],
["🦇 Qaysi sutemizuvchi hayvon faol uchish qobiliyatiga ega?",["Olmaxon","Ko'rshapalak","Pingvin","Tuya"],1,"Ko'rshapalaklar qanot yordamida faol uchadigan yagona sutemizuvchilar guruhidir.","Tabiiy fanlar"],
["🔭 Teleskop yordamida asosan nimani kuzatishadi?",["Juda mayda hujayralarni","Uzoq osmon jismlarini","Tovush to'lqinlarini","Yer osti qatlamlarini"],1,"Teleskop uzoqdagi osmon jismlaridan kelayotgan yorug'likni yig'ib, ularni kuzatishga yordam beradi.","Texnologiya"],
["📏 Perimetr nimani bildiradi?",["Shakl yuzasini","Shakl chegarasi uzunligini","Hajmni","Burchaklar yig'indisini"],1,"Perimetr geometrik shaklning barcha tomonlari uzunliklari yig'indisidir.","Matematika"],
["🎼 Musiqada bir oktava odatda nechta pog'onani qamrab oladi?",["5","6","7","8"],3,"Oktava bir xil nomdagi ikki tovush orasidagi interval bo'lib, diatonik ketma-ketlikda sakkiz pog'onani qamrab oladi.","Umumiy bilim"],
["🌱 Urug'dan yangi o'simlikning rivojlanishi nima deyiladi?",["Changlanish","Unish","Bug'lanish","Parchalanish"],1,"Unish jarayonida urug'dagi murtak rivojlanib, ildizcha va novda hosil qiladi.","Tabiiy fanlar"],
["🗺️ Ekvator Yer sharini qaysi yarimsharlarga ajratadi?",["Sharqiy va g'arbiy","Shimoliy va janubiy","Quruqlik va suv","Issiq va sovuq"],1,"Ekvator Yer sharini shimoliy va janubiy yarimsharlarga ajratuvchi shartli chiziqdir.","Geografiya"],
["📜 O'zbekiston Respublikasi Konstitutsiyasi ilk bor qaysi yilda qabul qilingan?",["1991","1992","1993","1995"],1,"O'zbekistonning birinchi Konstitutsiyasi 1992-yil 8-dekabrda qabul qilingan.","Tarix"],
["🧠 Qaysi sezgi a'zosi muvozanatni saqlashda muhim rol o'ynaydi?",["Ichki quloq","Til","Teri","Burun"],0,"Ichki quloqdagi vestibulyar apparat tana holati va muvozanatni sezishda qatnashadi.","Tabiiy fanlar"],
["🔐 Internetda HTTPS dagi oxirgi S nimani anglatadi?",["System","Secure","Server","Search"],1,"HTTPS dagi S 'Secure' so'zini bildiradi va aloqa TLS orqali shifrlanishini anglatadi.","Texnologiya"],
["🌞 Quyosh energiyasining asosiy manbai qaysi jarayon?",["Yonish","Yadro sintezi","Bug'lanish","Magnitlanish"],1,"Quyosh markazida vodorod yadrolari geliyga qo'shilib, yadro sintezi natijasida energiya ajraladi.","Tabiiy fanlar"],
["🏙️ O'zbekistonning eng katta shahri qaysi?",["Samarqand","Andijon","Toshkent","Namangan"],2,"Toshkent O'zbekiston poytaxti va aholisi eng ko'p bo'lgan shahardir.","Geografiya"],
["🧮 200 ning 15 foizi nechaga teng?",["15","20","30","35"],2,"200 ning 10 foizi 20, 5 foizi 10; jami 15 foiz 30 ga teng.","Matematika"],
["📚 'O'tkan kunlar' romanini kim yozgan?",["Cho'lpon","Abdulla Qodiriy","Oybek","G'afur G'ulom"],1,"Abdulla Qodiriyning 'O'tkan kunlar' romani o'zbek romanchiligining muhim namunalaridan biridir.","Til va adabiyot"],
["🧊 Muzning suvga aylanish jarayoni nima deyiladi?",["Qotish","Erish","Kondensatsiya","Sublimatsiya"],1,"Erish — moddaning qattiq holatdan suyuq holatga o'tish jarayonidir.","Tabiiy fanlar"],
["🌐 Dunyodagi eng katta materik qaysi?",["Afrika","Shimoliy Amerika","Yevrosiyo","Antarktida"],2,"Yevrosiyo maydoni bo'yicha eng katta materik bo'lib, Yevropa va Osiyoni birlashtiradi.","Geografiya"],
["⚖️ Moddaning zichligi qanday topiladi?",["Massa × hajm","Massa ÷ hajm","Hajm ÷ massa","Massa + hajm"],1,"Zichlik modda massasining hajmiga nisbatidir: ρ = m/V.","Tabiiy fanlar"],
["🪐 Quyoshga eng yaqin sayyora qaysi?",["Venera","Yer","Merkuriy","Mars"],2,"Merkuriy Quyoshga eng yaqin sayyora hisoblanadi.","Tabiiy fanlar"],
["🧭 Kompas ignasi odatda qaysi yo'nalishni ko'rsatadi?",["Sharq-g'arb","Shimol-janub","Faqat sharq","Faqat g'arb"],1,"Kompas magnit maydoniga moslanib, ignasi shimol-janub yo'nalishida joylashadi.","Umumiy bilim"],
["🏛️ Buyuk Ipak yo'li asosan nimani bog'lagan?",["Afrika va Avstraliyani","Sharq va G'arbni","Shimoliy va Janubiy qutbni","Faqat Hindistonni"],1,"Buyuk Ipak yo'li Sharqiy Osiyoni Markaziy Osiyo orqali Yaqin Sharq va Yevropa bilan bog'lagan savdo yo'llari tarmog'i edi.","Tarix"],
["📡 Wi-Fi texnologiyasi ma'lumotni asosan nima orqali uzatadi?",["Suv to'lqinlari","Radio to'lqinlari","Tovush","Yorug'lik tolasi"],1,"Wi-Fi qurilmalar o'rtasida ma'lumotni radio to'lqinlari yordamida simsiz uzatadi.","Texnologiya"],
["🧬 DNK molekulasining mashhur shakli qanday?",["Yagona halqa","Ikki spiral","To'g'ri chiziq","Uchburchak"],1,"DNK odatda bir-biriga o'ralgan ikki zanjirdan iborat qo'sh spiral tuzilishga ega.","Tabiiy fanlar"],
["🌧️ Bulutlarda suv tomchilari qanday hosil bo'ladi?",["Suv bug'ining kondensatsiyasidan","Tuzning erishidan","Muzning yonishidan","Shamolning sovishidan"],0,"Havodagi suv bug'i sovib, mayda tomchilar yoki muz kristallariga kondensatsiyalanadi.","Tabiiy fanlar"],
["🗣️ Bir nechta tilni biladigan odam qanday ataladi?",["Monolingv","Bilingv faqat","Poliglot","Dialekt"],2,"Poliglot bir nechta tilni biladigan yoki ularda muloqot qila oladigan kishidir.","Til va adabiyot"],
["🪨 Olmosning kimyoviy tarkibi asosan qaysi elementdan iborat?",["Temir","Uglerod","Kremniy","Kalsiy"],1,"Olmos uglerod atomlaridan tashkil topgan bo'lib, atomlari mustahkam kristall panjara hosil qiladi.","Tabiiy fanlar"],
["🌍 Yerning o'z o'qi atrofida bir marta aylanishi taxminan qancha vaqt oladi?",["12 soat","24 soat","30 kun","365 kun"],1,"Yerning o'z o'qi atrofidagi aylanishi sutka va kun-tun almashinuvini yuzaga keltiradi.","Geografiya"],
["🧲 Magnitning bir xil qutblari bir-biriga qanday ta'sir qiladi?",["Tortishadi","Itarishadi","Ta'sirlashmaydi","Erib ketadi"],1,"Magnitning bir xil qutblari itarishadi, qarama-qarshi qutblari esa tortishadi.","Tabiiy fanlar"],
["🧮 9 ning kubi nechaga teng?",["27","18","81","729"],3,"Sonning kubi uni uch marta ko'paytirishdir: 9 × 9 × 9 = 729.","Matematika"],
["🧭 Xaritalarda shimol odatda qaysi tomonda joylashtiriladi?",["Pastda","Yuqorida","O'ngda","Chapda"],1,"Ko'pchilik an'anaviy xaritalarda shimol yuqori tomonda, janub esa pastda ko'rsatiladi.","Geografiya"],
["🫁 Inson nafas olganda kislorod qonga asosan qayerda o'tadi?",["Bronxlarda","O'pka alveolalarida","Burun bo'shlig'ida","Kekirdakda"],1,"O'pka alveolalarining yupqa devorlari orqali kislorod qonga, karbonat angidrid esa havoga o'tadi.","Tabiiy fanlar"],
["📖 'Boburnoma' asarining muallifi kim?",["Alisher Navoiy","Zahiriddin Muhammad Bobur","Amir Temur","Abdulla Qodiriy"],1,"'Boburnoma' Zahiriddin Muhammad Bobur tomonidan yozilgan tarixiy-memuar asardir.","Til va adabiyot"],
["🏛️ Qadimgi Olimpiya o'yinlari qaysi mamlakatda boshlangan?",["Italiya","Yunoniston","Misr","Hindiston"],1,"Qadimgi Olimpiya o'yinlari Yunonistonning Olimpiya hududida o'tkazilgan.","Tarix"],
["🌡️ Haroratni o'lchaydigan asbob nima?",["Barometr","Termometr","Ampermetr","Kompas"],1,"Termometr haroratni o'lchash uchun ishlatiladi.","Tabiiy fanlar"],
["🔢 Rim raqamida X belgisi qaysi sonni bildiradi?",["5","10","50","100"],1,"Rim raqamlarida X belgisi 10 sonini anglatadi.","Umumiy bilim"],
["🌋 Vulqon otilishida yer yuzasiga chiqadigan erigan tog' jinsi nima deyiladi?",["Magma","Lava","Granit","Ohaktosh"],1,"Yer ostidagi erigan jins magma deyiladi; u yer yuzasiga chiqqach lava deb ataladi.","Tabiiy fanlar"],
["🌐 HTML asosan nima yaratish uchun ishlatiladi?",["Veb-sahifa tuzilmasi","Kompyuter protsessori","Internet kabeli","Antivirus bazasi"],0,"HTML veb-sahifaning mazmuni va tuzilmasini belgilash uchun ishlatiladigan belgilash tilidir.","Texnologiya"],
["📐 Uchburchak ichki burchaklari yig'indisi necha gradus?",["90°","180°","270°","360°"],1,"Evklid geometriyasida har qanday uchburchak ichki burchaklari yig'indisi 180 gradusga teng.","Matematika"],
["🪐 Saturn sayyorasining eng mashhur tashqi xususiyati nima?",["Katta halqalari","Ikki yo'ldoshi","Moviy okeanlari","Faol vulqonlari"],0,"Saturn muz va chang zarralaridan tashkil topgan keng halqalari bilan mashhur.","Tabiiy fanlar"],
["🎭 Teatr asari uchun yozilgan adabiy matn qanday ataladi?",["Roman","Drama","Lug'at","Maqola"],1,"Drama sahnada ijro etish uchun yoziladigan adabiy asar turidir.","Til va adabiyot"],
["🌳 Fotosintez asosan o'simlikning qaysi qismida sodir bo'ladi?",["Ildizida","Bargida","Gul changida","Urug'ida"],1,"Fotosintez asosan barg hujayralaridagi xloroplastlarda amalga oshadi.","Tabiiy fanlar"],
["📡 Radioaloqa signallarni qaysi to'lqinlar orqali uzatadi?",["Tovush to'lqinlari","Radio to'lqinlari","Suv to'lqinlari","Seysmik to'lqinlar"],1,"Radioaloqa elektromagnit spektrining radio to'lqinlari yordamida axborot uzatadi.","Texnologiya"],
["🏞️ Daryo boshlanadigan joy nima deb ataladi?",["Quyilish joyi","Manba","Delta","O'zan"],1,"Daryoning boshlanish nuqtasi manba deyiladi; u buloq, ko'l yoki muzlik bo'lishi mumkin.","Geografiya"],
["🧪 pH qiymati 7 bo'lgan sof suv qanday muhitga ega?",["Kislotali","Ishqoriy","Neytral","Radioaktiv"],2,"25 °C atrofida sof suvning pH qiymati 7 bo'lib, u neytral muhit hisoblanadi.","Tabiiy fanlar"],
["📚 'Alpomish' qanday xalq og'zaki ijodi janriga mansub?",["Maqol","Doston","Topishmoq","Ertak"],1,"'Alpomish' o'zbek xalqining mashhur qahramonlik dostoni hisoblanadi.","Til va adabiyot"],
["🧮 1 kilometr necha metrga teng?",["10","100","1000","10000"],2,"Bir kilometr 1000 metrga teng.","Matematika"],
["🦒 Quruqlikdagi eng baland hayvon qaysi?",["Fil","Jirafa","Tuya","Tuyaqush"],1,"Jirafa uzun bo'yni va oyoqlari tufayli quruqlikdagi eng baland hayvon hisoblanadi.","Tabiiy fanlar"],
["🌍 Yer atmosferasida eng ko'p uchraydigan gaz qaysi?",["Kislorod","Azot","Karbonat angidrid","Argon"],1,"Yer atmosferasining taxminan 78 foizini azot tashkil etadi.","Tabiiy fanlar"],
["🏰 Buyuk Xitoy devori qaysi mamlakatda joylashgan?",["Yaponiya","Xitoy","Mo'g'uliston","Koreya"],1,"Buyuk Xitoy devori Xitoy hududida qurilgan tarixiy mudofaa inshootlari majmuasidir.","Tarix"],
["💡 Lampochkaning elektr energiyasini asosan nimaga aylantiradi?",["Faqat tovushga","Yorug'lik va issiqlikka","Faqat mexanik energiyaga","Kimyoviy energiyaga"],1,"Elektr lampochkasi elektr energiyasini yorug'lik va issiqlik energiyasiga aylantiradi.","Texnologiya"],
["🧬 Qonning qizil rangiga asosan qaysi modda sabab bo'ladi?",["Xlorofill","Gemoglobin","Insulin","Keratin"],1,"Qizil qon hujayralaridagi gemoglobin tarkibidagi temir qonning qizil rangini beradi.","Tabiiy fanlar"],
["🕰️ Bir sutkada necha soat bor?",["12","18","24","36"],2,"Bir sutka 24 soatdan iborat.","Umumiy bilim"],
["🌊 Suvning muzlash harorati normal bosimda necha °C?",["0","10","50","100"],0,"Normal atmosfera bosimida toza suv 0 °C da muzlaydi.","Tabiiy fanlar"],
["🏙️ Eyfel minorasi qaysi shaharda joylashgan?",["London","Parij","Rim","Madrid"],1,"Eyfel minorasi Fransiya poytaxti Parijning mashhur ramzlaridan biridir.","Geografiya"],
["🧠 Mantiqiy ketma-ketlik: 2, 4, 8, 16, ... Keyingi son qaysi?",["18","24","32","36"],2,"Har bir had avvalgisidan ikki baravar katta: 16 × 2 = 32.","Mantiq"],
["🧾 Davlat madhiyasi, bayrog'i va gerbi nimaning ramzlari?",["Sport klubi","Davlat","Maktab","Shahar transporti"],1,"Madhiya, bayroq va gerb davlatning rasmiy ramzlari hisoblanadi.","Umumiy bilim"]
];
async function seedBuiltinQuestions(e){
 const existing=await db(e,"quizbot_questions","source=eq.builtin&select=id&limit=100");if(existing.length>=BUILTIN_QUESTIONS.length)return;
 for(const item of BUILTIN_QUESTIONS){
  const [question,options,index,explanation,category]=item,n=norm(question),digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(n)),hash=[...new Uint8Array(digest)].map(v=>v.toString(16).padStart(2,"0")).join("");
  await db(e,"quizbot_questions","on_conflict=content_hash",{method:"POST",headers:{"Prefer":"resolution=ignore-duplicates,return=minimal"},body:JSON.stringify({question_text:question,normalized_text:n,answer_text:options[index],explanation,category,difficulty:"medium",options,content_hash:hash,status:"approved",source:"builtin"})});
 }
}
async function question(e,questionNumber=0){
 if(questionNumber>=19&&questionNumber<=25){
  const manual=await db(e,"quizbot_questions","source=eq.manual&select=*&order=content_hash.asc&limit=50");
  const prior=await db(e,"quizbot_schedule","select=question_id&limit=2000");
  const usedManual=new Set(prior.map(x=>String(x.question_id)));
  const freshManual=manual.find(x=>!usedManual.has(String(x.id)));
  if(freshManual)return freshManual;
 }
 const pool=async()=>await db(e,"quizbot_questions","source=in.(gemini_batch,builtin)&status=eq.approved&select=*&order=created_at.asc&limit=100");
 const scheduled=await db(e,"quizbot_schedule","select=question_id&limit=2000");
 const used=new Set(scheduled.map(x=>String(x.question_id)));
 let available=(await pool()).filter(x=>!used.has(String(x.id)));
 if(!available.length){
  try{await generateQuestionBatch(e,5);}catch(err){console.error("AI batch ishlamadi, tayyor savollar zaxirasi ishga tushadi:",String(err?.message||err));await seedBuiltinQuestions(e);}
  available=(await pool()).filter(x=>!used.has(String(x.id)));
 }
 if(available.length)return available[0];
 throw Error("Yangi savollar zaxirasi topilmadi");
}
async function settings(e){return (await db(e,"quizbot_settings","id=eq.1&select=*"))[0]}
async function cron(e,now){
 const c=await settings(e);if(!c?.enabled)return;
 const local=new Date(now.getTime()+5*3600000),day=local.toISOString().slice(0,10),hh=local.getUTCHours(),mm=local.getUTCMinutes();
 // Har ikki sessiya boshlanishidan keyingi 20 daqiqa ichida qayta urinish mumkin.
 const kind=hh===12&&mm<20?'afternoon':hh===19&&mm<20?'evening':null;
 if(kind){
  const start=new Date(day+'T'+(kind==='afternoon'?'12:00:00':'19:00:00')+'+05:00'),end=new Date(start.getTime()+3600000),questionCount=25,sessionTitle=kind==='afternoon'?'TUSHLIK':'KECHKI';
  let sess=(await db(e,'quizbot_sessions','on_conflict=session_date,session_type',{method:'POST',headers:{'Prefer':'resolution=ignore-duplicates,return=representation'},body:JSON.stringify({session_date:day,session_type:kind,starts_at:start.toISOString(),ends_at:end.toISOString(),status:'active'})}))[0];
  if(!sess)sess=(await db(e,'quizbot_sessions','session_date=eq.'+day+'&session_type=eq.'+kind+'&select=*'))[0];
  if(sess&&sess.status==='failed'){
   await db(e,'quizbot_sessions','id=eq.'+sess.id,{method:'PATCH',headers:{'Prefer':'return=minimal'},body:JSON.stringify({status:'active'})});
   sess.status='active';
  }
  if(sess&&sess.status==='active'){
   const prior=await db(e,'quizbot_schedule','session_id=eq.'+sess.id+'&select=id,question_id,question_number,status,telegram_message_id');
   const postedCount=prior.filter(x=>x.status==='posted').length;if(postedCount<questionCount)try{let postedThisRun=0;
    for(let i=1;i<=questionCount;i++){
     if(postedThisRun>=5)break;
     const existing=prior.find(x=>Number(x.question_number)===i);
     // Posted yoki yuborilayotgan savolni qayta jo'natmaymiz.
     if(existing?.status==='posted'||existing?.status==='sending')continue;
     const q=existing?(await db(e,'quizbot_questions','id=eq.'+existing.question_id+'&select=*'))[0]:await question(e,i);
     let scheduleId=existing?.id;
     if(!existing){
      const scheduledAt=new Date(start.getTime()+(i-1)*1000).toISOString();
      const rows=await db(e,'quizbot_schedule','',{method:'POST',headers:{'Prefer':'return=representation'},body:JSON.stringify({session_id:sess.id,question_id:q.id,question_number:i,scheduled_at:scheduledAt,status:'queued'})});
      scheduleId=rows[0].id;
      // E'lonni faqat birinchi savol jadvalga yozilgandan keyin yuboramiz.
      // AI xato bersa va schedule bo'sh qolsa, har daqiqada takroriy e'lon yuborilmaydi.
      if(!prior.length&&i===1)await tg(e,'sendMessage',{chat_id:c.channel_username,text:'🏆 BILIMDON — '+sessionTitle+' BELLASHUVI\n\n🧠 '+questionCount+' ta yangi savol!\n⏰ Javob berish uchun 1 soat vaqt.\n⚡ Har bir javobdan so‘ng natija darhol ko‘rsatiladi.'});
     }
     const answerIndex=q.options.findIndex(x=>x===q.answer_text);
     if(answerIndex<0)throw Error('Poll uchun to‘g‘ri javob varianti topilmadi');
     // Avval Quiz Poll yuboriladi; rasm xatosi pollni qayta yuborishga sabab bo'lmaydi.
     await db(e,'quizbot_schedule','id=eq.'+scheduleId,{method:'PATCH',headers:{'Prefer':'return=minimal'},body:JSON.stringify({status:'sending'})});
     const pollQuestion=Array.from(q.question_text).slice(0,300).join('');
     const pollExplanation=Array.from(String(q.explanation||'')).slice(0,200).join('');
     let msg;
     try{
      msg=await tg(e,'sendPoll',{chat_id:c.channel_username,question:pollQuestion,options:q.options,is_anonymous:false,type:'quiz',correct_option_ids:[answerIndex],explanation:pollExplanation,allows_multiple_answers:false,allows_revoting:false,close_date:Math.floor(end.getTime()/1000)});
     }catch(pollErr){
      await db(e,'quizbot_schedule','id=eq.'+scheduleId,{method:'PATCH',headers:{'Prefer':'return=minimal'},body:JSON.stringify({status:'queued'})});
      throw pollErr;
     }
     await db(e,'quizbot_schedule','id=eq.'+scheduleId,{method:'PATCH',headers:{'Prefer':'return=minimal'},body:JSON.stringify({status:'posted',telegram_message_id:msg.message_id,telegram_poll_id:msg.poll.id,post_type:'poll'})});
     if(i%3===0){
      try{const image=await quizImage(e,q);if(image?.bytes?.length)await tgPhoto(e,c.channel_username,'🌟 BILIMDON | '+sessionTitle+' — '+i+'/'+questionCount+'\n\n🖼️ Savolga oid rasm',null,image);}
      catch(imageErr){console.error('Quiz image failed; poll already posted:',String(imageErr&&imageErr.message||imageErr));}
     }
     await db(e,'quizbot_questions','id=eq.'+q.id,{method:'PATCH',headers:{'Prefer':'return=minimal'},body:JSON.stringify({status:'posted',posted_at:now.toISOString()})});
     postedThisRun++;
    }
   }catch(err){console.error('Session start failed: '+String(err&&err.message||err),err&&err.stack||'');await db(e,'quizbot_sessions','id=eq.'+sess.id,{method:'PATCH',headers:{'Prefer':'return=minimal'},body:JSON.stringify({status:'failed'})})}
  }
 }
 const due=await db(e,'quizbot_sessions','status=eq.active&ends_at=lte.'+encodeURIComponent(now.toISOString())+'&select=*');
 for(const s of due){
  const sched=await db(e,'quizbot_schedule','session_id=eq.'+s.id+'&select=question_id,question_number,revealed_at');
  const ids=sched.map(x=>x.question_id);if(!ids.length){await db(e,'quizbot_sessions','id=eq.'+s.id,{method:'PATCH',headers:{'Prefer':'return=minimal'},body:JSON.stringify({status:'failed',finished_at:now.toISOString()})});console.error('Session yakunlandi, lekin savollar jadvali bo‘sh:',s.id);continue;}
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
 if(u.message){const m=u.message,v=m.from;if(m.text?.startsWith("/start")){await db(e,"quizbot_subscribers","on_conflict=telegram_user_id",{method:"POST",headers:{"Prefer":"resolution=merge-duplicates,return=minimal"},body:JSON.stringify({telegram_user_id:v.id,username:v.username||null,first_name:v.first_name||null,last_seen_at:new Date().toISOString()})});await db(e,"quizbot_growth_events","",{method:"POST",headers:{"Prefer":"return=minimal"},body:JSON.stringify({event_type:"start",telegram_user_id:v.id})});await tg(e,"sendMessage",{chat_id:m.chat.id,text:"🏆 <b>BILIMDON AI</b> — <b>INTELLEKTUAL SHOU</b>\n\nAssalomu alaykum, "+escapeHtml(v.first_name||"Bilimdon")+"! 👋\n\n🧠 Bilimingizni sinab ko‘ring, yangi bilimlarni kashf eting va TOP-10 reytingidan joy oling!\n\n<b>🎯 Bellashuv vaqtlari:</b> har kuni 12:00 va 19:00\n<b>📝 Savollar:</b> har bir bellashuvda 25 ta\n<b>🏅 Mukofot:</b> har bir to‘g‘ri javob uchun 1 ball\n\n📌 Quyidagi menyudan kerakli bo‘limni tanlang va bellashuvga qo‘shiling!\n\n🍀 Omad tilaymiz!",parse_mode:"HTML",reply_markup:{inline_keyboard:[[{text:"👤 Mening profilim",callback_data:"menu:profile"},{text:"🏆 Reyting",callback_data:"menu:leaderboard"}],[{text:"📅 Bellashuv jadvali",callback_data:"menu:schedule"},{text:"📊 Natijalarim",callback_data:"menu:results"}],[{text:"📖 Qoidalar",callback_data:"menu:rules"},{text:"📢 Viktorina kanali",url:"https://t.me/universal_ai_quiz"}]]}})}
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
   await tg(e,'sendMessage',{chat_id:uid,text:'📅 <b>BELLASHUV JADVALI</b>\n\n☀️ Tushlik bellashuvi — <b>12:00</b>\n🌆 Kechki bellashuv — <b>19:00</b>\n🧠 Har birida 25 ta savol\n⏳ Javob berish uchun 1 soat\n\nBarcha vaqtlar Toshkent vaqti bilan.' ,parse_mode:'HTML'});
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
 if(u.pathname==="/health")return Response.json({ok:true,service:"bilimdon",checks:{telegramConfigured:!!(e.BOT_TOKEN&&e.TELEGRAM_WEBHOOK_SECRET),supabaseConfigured:!!(e.SUPABASE_URL&&e.SUPABASE_SERVICE_ROLE_KEY),geminiConfigured:!!e.GEMINI_API_KEY,geminiModel:e.GEMINI_MODEL||"gemini-3.8-flash",cloudflareAI:!!e.AI?.run,imageGenerator:e.GEMINI_IMAGE_MODEL||"cloudflare-ai"}});if(u.pathname!=="/telegram"||req.method!=="POST")return new Response("Not found",{status:404});if(req.headers.get("X-Telegram-Bot-Api-Secret-Token")!==e.TELEGRAM_WEBHOOK_SECRET)return new Response("Unauthorized",{status:401});try{await update(e,await req.json());return Response.json({ok:true})}catch(err){console.error(err);return Response.json({ok:false},{status:500})}},
 async scheduled(event,e,ctx){ctx.waitUntil(cron(e,new Date(event.scheduledTime)))}
};