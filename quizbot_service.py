import asyncio
import hashlib
import json
import logging
import os
import random
import re
from datetime import datetime, date, time, timedelta
from zoneinfo import ZoneInfo

import psycopg
from psycopg.rows import dict_row
from google import genai
from google.genai import types
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import Application, CommandHandler, CallbackQueryHandler, ContextTypes

logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))
log = logging.getLogger("bilimdon-quizbot")

BOT_TOKEN = os.environ["BOT_TOKEN"]
DATABASE_URL = os.environ["DATABASE_URL"]
GEMINI_API_KEY = os.environ["GEMINI_API_KEY"]
CHANNEL_ID = os.getenv("CHANNEL_ID", "@universal_ai_quiz")
MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
TZ = ZoneInfo("Asia/Tashkent")
ai = genai.Client(api_key=GEMINI_API_KEY)


def db():
    return psycopg.connect(DATABASE_URL, row_factory=dict_row)


def settings():
    with db() as conn, conn.cursor() as cur:
        cur.execute("select * from public.quizbot_settings where id=1")
        return cur.fetchone()


def make_question(existing):
    categories = ["Mantiq", "Matematika", "Tabiiy fanlar", "Tarix", "Geografiya",
                  "Til va adabiyot", "Texnologiya", "Umumiy bilim"]
    category = random.choice(categories)
    prompt = f"""O'zbek tilida bitta original viktorina savoli tuz.
Kategoriya: {category}. Daraja: {random.choice(['easy','medium','hard'])}.
Quyidagi oldingi savollarni aynan yoki mazmunan takrorlama:
{json.dumps(existing[-100:], ensure_ascii=False)}
Talablar: aniq tekshiriladigan bitta savol; 4 ta qisqa va o'zaro farqli variant;
faqat bitta to'g'ri javob; o'zbek lotin yozuvi; javob va izoh sodda, tushunarli.
Faqat JSON qaytar: {{"question":"...","options":["...","...","...","..."],
"answer":"variant matni","explanation":"1-3 gap","category":"{category}",
"difficulty":"easy|medium|hard"}}"""
    response = ai.models.generate_content(
        model=MODEL, contents=prompt,
        config=types.GenerateContentConfig(response_mime_type="application/json")
    )
    data = json.loads(response.text or "{}")
    q = str(data["question"]).strip()
    opts = data["options"]
    ans = str(data["answer"]).strip()
    if len(opts) != 4 or ans not in opts or len(q) < 12:
        raise ValueError("AI savoli validatsiyadan o'tmadi")
    if len(set(opts)) != 4:
        raise ValueError("Javob variantlari takrorlangan")
    data["question"], data["options"], data["answer"] = q, opts, ans
    data["category"] = str(data.get("category") or category)
    data["difficulty"] = data.get("difficulty") if data.get("difficulty") in ("easy","medium","hard") else "medium"
    return data


def build_daily_queue(day):
    cfg = settings()
    if not cfg or not cfg["enabled"]:
        return
    with db() as conn, conn.cursor() as cur:
        cur.execute("select count(*) as n from public.quizbot_schedule where scheduled_at::date=%s and status <> 'cancelled'", (day,))
        if cur.fetchone()["n"] >= cfg["daily_question_count"]:
            return
        cur.execute("select question_text from public.quizbot_questions order by created_at desc limit 200")
        existing = [r["question_text"] for r in cur.fetchall()]
    count = cfg["daily_question_count"]
    start = cfg["posting_window_start"]
    end = cfg["posting_window_end"]
    start_min = start.hour * 60 + start.minute
    end_min = end.hour * 60 + end.minute
    if end_min <= start_min:
        raise ValueError("Posting window noto'g'ri")
    # Randomized posting times, with at least 10 minutes between adjacent slots.
    span = end_min - start_min
    slots = sorted(random.sample(range(start_min, end_min), min(count, span)))
    if len(slots) < count:
        raise ValueError("Posting oynasida 30 ta alohida vaqt uchun joy yetarli emas")
    made = 0
    for minute in slots:
        for attempt in range(5):
            data = make_question(existing)
            with db() as conn, conn.cursor() as cur:
                cur.execute("select public.quizbot_find_similar_question(%s, %s) as similar", (data["question"], 0.72))
                dup = cur.fetchone()["similar"]
                if dup:
                    existing.append(data["question"])
                    continue
                normalized = re.sub(r"\\s+", " ", data["question"].casefold()).strip()
                digest = hashlib.sha256(normalized.encode()).hexdigest()
                cur.execute("""insert into public.quizbot_questions
                    (question_text, normalized_text, answer_text, explanation, category,
                     difficulty, options, content_hash, status, source)
                    values (%s,%s,%s,%s,%s,%s,%s,%s,'approved','gemini')
                    on conflict (content_hash) do nothing returning id""",
                    (data["question"], normalized, data["answer"], data.get("explanation",""),
                     data["category"], data["difficulty"], json.dumps(data["options"], ensure_ascii=False), digest))
                row = cur.fetchone()
                if not row:
                    existing.append(data["question"])
                    continue
                local_dt = datetime.combine(day, time(minute // 60, minute % 60), TZ)
                cur.execute("""insert into public.quizbot_schedule (scheduled_at, question_id, status)
                               values (%s,%s,'queued') on conflict (scheduled_at) do nothing""",
                            (local_dt, row["id"]))
                existing.append(data["question"])
                made += 1
                break
        if made >= count:
            break
    log.info("Kunlik reja: %s ta yangi savol jadvalga qo'shildi", made)


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = update.effective_user
    with db() as conn, conn.cursor() as cur:
        cur.execute("""insert into public.quizbot_subscribers
          (telegram_user_id, username, first_name, last_seen_at)
          values (%s,%s,%s,now()) on conflict (telegram_user_id) do update
          set username=excluded.username, first_name=excluded.first_name, last_seen_at=now()""",
          (user.id, user.username, user.first_name))
        cur.execute("insert into public.quizbot_growth_events(event_type,telegram_user_id) values ('start',%s)", (user.id,))
    await update.message.reply_text("Assalomu alaykum! 🧠 Bilimdon AI viktorinasiga xush kelibsiz. Kanalimiz: " + CHANNEL_ID)


async def leaderboard(update: Update, context: ContextTypes.DEFAULT_TYPE):
    with db() as conn, conn.cursor() as cur:
        cur.execute("""select coalesce('@'||username, first_name, 'Ishtirokchi') as who,
          score, correct_answers from public.quizbot_subscribers
          order by score desc, correct_answers desc limit 10""")
        rows = cur.fetchall()
    text = "🏆 TOP-10 BILIMDON\n\n" + ("\n".join(f"{i}. {r['who']} — {r['score']} ball" for i,r in enumerate(rows,1)) if rows else "Hozircha natijalar yo'q.")
    await update.message.reply_text(text)


async def answer_button(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    try:
        _, qid, raw_idx = query.data.split(":")
        idx = int(raw_idx)
        user = query.from_user
        with db() as conn, conn.cursor() as cur:
            cur.execute("""select q.*, q.posted_at from public.quizbot_questions q where q.id=%s""", (qid,))
            q = cur.fetchone()
            if not q or not q["posted_at"] or datetime.now(q["posted_at"].tzinfo) >= q["posted_at"] + timedelta(minutes=3):
                await query.answer("Javob berish vaqti tugagan.", show_alert=True)
                return
            opts = q["options"] if isinstance(q["options"], list) else json.loads(q["options"])
            if idx not in range(4):
                return
            correct = opts[idx] == q["answer_text"]
            cur.execute("""insert into public.quizbot_subscribers(telegram_user_id,username,first_name,last_seen_at)
              values (%s,%s,%s,now()) on conflict(telegram_user_id) do update set last_seen_at=now()""",
              (user.id,user.username,user.first_name))
            cur.execute("""insert into public.quizbot_answers(question_id,telegram_user_id,answer_text,is_correct)
              values (%s,%s,%s,%s) on conflict(question_id,telegram_user_id) do nothing returning id""",
              (qid,user.id,opts[idx],correct))
            inserted = cur.fetchone()
            if inserted and correct:
                cur.execute("""update public.quizbot_subscribers set score=score+1,
                  correct_answers=correct_answers+1,total_answers=total_answers+1 where telegram_user_id=%s""",(user.id,))
            elif inserted:
                cur.execute("update public.quizbot_subscribers set total_answers=total_answers+1 where telegram_user_id=%s",(user.id,))
        await query.answer("To'g'ri! 🎉" if correct else "Javob qabul qilindi!", show_alert=True)
    except Exception:
        log.exception("Javobni saqlashda xato")
        await query.answer("Javobni saqlashda xatolik.", show_alert=True)


async def process_due(app):
    now = datetime.now(TZ)
    with db() as conn, conn.cursor() as cur:
        cur.execute("""select s.id as schedule_id, q.* from public.quizbot_schedule s
          join public.quizbot_questions q on q.id=s.question_id
          where s.status='queued' and s.scheduled_at <= %s
          order by s.scheduled_at limit 5 for update of s skip locked""", (now,))
        due = cur.fetchall()
        for item in due:
            opts = item["options"] if isinstance(item["options"], list) else json.loads(item["options"])
            keyboard = [[InlineKeyboardButton(f"{'ABCD'[i]}. {v}", callback_data=f"ans:{item['id']}:{i}")] for i,v in enumerate(opts)]
            try:
                msg = await app.bot.send_message(chat_id=CHANNEL_ID,
                    text=f"🧠 {item['question_text']}\n\n⏳ Javob berish uchun 3 daqiqa!",
                    reply_markup=InlineKeyboardMarkup(keyboard))
                cur.execute("update public.quizbot_schedule set status='posted', telegram_message_id=%s where id=%s",(msg.message_id,item["schedule_id"]))
                cur.execute("update public.quizbot_questions set status='posted', posted_at=%s where id=%s",(now,item["id"]))
            except Exception as exc:
                cur.execute("update public.quizbot_schedule set status='failed', error_text=%s where id=%s",(str(exc)[:1000],item["schedule_id"]))
                log.exception("Kanalga savol yuborilmadi")
    # Reveal answers for questions whose 3-minute window has elapsed.
    with db() as conn, conn.cursor() as cur:
        cur.execute("""select s.telegram_message_id, q.question_text, q.answer_text, q.explanation, q.id
          from public.quizbot_schedule s join public.quizbot_questions q on q.id=s.question_id
          where s.status='posted' and q.posted_at <= %s""",(now-timedelta(minutes=3),))
        reveal = cur.fetchall()
        for r in reveal:
            cur.execute("select id from public.quizbot_schedule where telegram_message_id=%s",(r["telegram_message_id"],))
            sid=cur.fetchone()["id"]
            try:
                await app.bot.edit_message_text(chat_id=CHANNEL_ID,message_id=r["telegram_message_id"],
                  text=f"🧠 {r['question_text']}\n\n✅ To'g'ri javob: {r['answer_text']}\n\n💡 Izoh: {r['explanation'] or 'Ajoyib qatnashganingiz uchun rahmat!'}\n\n🏆 Keyingi savolni kuting!",
                  reply_markup=None)
                cur.execute("update public.quizbot_schedule set status='revealed' where id=%s",(sid,))
            except Exception as exc:
                log.warning("Javobni ochishda xato: %s",exc)


async def scheduler(app):
    last_prepared = None
    while True:
        try:
            cfg = settings()
            today = datetime.now(TZ).date()
            if cfg and cfg["enabled"] and last_prepared != today:
                await asyncio.to_thread(build_daily_queue, today)
                last_prepared = today
            if cfg and cfg["enabled"]:
                await process_due(app)
        except Exception:
            log.exception("Rejalashtiruvchi xatosi")
        await asyncio.sleep(15)


async def post_init(app):
    app.create_task(scheduler(app))


def main():
    app = Application.builder().token(BOT_TOKEN).post_init(post_init).build()
    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler("leaderboard", leaderboard))
    app.add_handler(CallbackQueryHandler(answer_button, pattern=r"^ans:"))
    log.info("Bilimdon AI bot ishga tushdi")
    app.run_polling(drop_pending_updates=True)


if __name__ == "__main__":
    main()
