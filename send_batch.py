import os
import asyncio
import argparse
from datetime import datetime
from zoneinfo import ZoneInfo

from dotenv import load_dotenv
from telegram import Bot, InlineKeyboardButton, InlineKeyboardMarkup

from database import ( get_batch_questions, mark_question_sent,save_poll_question )

load_dotenv()

TOKEN = os.getenv("BOT_TOKEN")
CHANNEL_ID = os.getenv("CHANNEL_ID")

CATEGORY_EMOJIS = {
    "Geografiya": "🌍",
    "Tarix": "🏛",
    "Biologiya": "🧬",
    "Fizika": "⚡",
    "Kimyo": "🧪",
    "Adabiyot": "📚",
    "Sport": "🏆",
    "Texnologiya": "💻",
    "Umumiy bilimlar": "🧠",
    "Umumiy": "🧠"
}


def prepare_questions(questions):
    if len(questions) != 20:
        raise ValueError(
            f"20 ta savol kerak, topildi: {len(questions)}"
        )

    normal = [q for q in questions if not q["image_path"]]
    images = [q for q in questions if q["image_path"]]

    if len(normal) != 19 or len(images) != 1:
        raise ValueError("19 ta oddiy va 1 ta rasmli savol bo‘lishi kerak.")

    for q in questions:
        if len(q["options"]) != 4:
            raise ValueError(f"4 ta variant yo‘q: {q['id']}")

        correct = str(q["correct_answer"]).strip().casefold()
        options = [str(x).strip().casefold() for x in q["options"]]

        if correct not in options:
            raise ValueError(f"To‘g‘ri javob variantlarda yo‘q: {q['id']}")

        if q["image_path"] and not os.path.isfile(q["image_path"]):
            raise ValueError(f"Rasm topilmadi: {q['image_path']}")


def create_keyboard(question):
    letters = ["A", "B", "C", "D"]
    buttons = []

    for i, option in enumerate(question["options"]):
        buttons.append(
            InlineKeyboardButton(
                text=f"{letters[i]}) {option}",
                callback_data=f"ans:{question['id']}:{i}"
            )
        )

    return InlineKeyboardMarkup([
        buttons[:2],
        buttons[2:]
    ])


def show_preview(questions):
    print("\nBILIMDON — YANGI TUGMALI SAVOLLAR")
    print("=" * 50)

    for i, q in enumerate(questions, 1):
        emoji = CATEGORY_EMOJIS.get(q["category"], "🧠")
        print(f"\n{i}. {emoji} {q['question']}")

        for j, option in enumerate(q["options"]):
            print(f"   {chr(65 + j)}) {option}")

        print("   Rasmli savol" if q["image_path"] else "   Oddiy savol")

    print("\nJami savollar:", len(questions))


async def send_batch(questions):
    bot = Bot(token=TOKEN)
    sent_count = 0
    skipped_count = 0

    await bot.initialize()
    try:
        for i, q in enumerate(questions, 1):
            if q["sent_at"]:
                skipped_count += 1
                continue

            emoji = CATEGORY_EMOJIS.get(q["category"], "🧠")
            options = [str(x) for x in q["options"]]

            question_text = (
                f"{emoji} {q['question']}\n\n"
                + "\n".join(
                    f"{chr(65+j)}) {option}"
                    for j, option in enumerate(options)
                )
            )

            if q["image_path"]:
                with open(q["image_path"], "rb") as photo:
                    await bot.send_photo(
                        chat_id=CHANNEL_ID,
                        photo=photo,
                        caption=question_text,
                        reply_markup=create_keyboard(q)
                    )
            else:
                await bot.send_message(
                    chat_id=CHANNEL_ID,
                    text=question_text,
                    reply_markup=create_keyboard(q)
                )

            mark_question_sent(q["id"])
            sent_count += 1
            print(f"✅ {i}-savol yuborildi.")
            await asyncio.sleep(4)

    finally:
        await bot.shutdown()

    print(f"\nYuborildi: {sent_count}")
    print(f"O‘tkazib yuborildi: {skipped_count}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--batch", type=int, default=1)
    parser.add_argument("--send", action="store_true")
    args = parser.parse_args()

    if not TOKEN or not CHANNEL_ID:
        print("XATO: .env sozlamalarini tekshiring!")
        return

    today = datetime.now(ZoneInfo("Asia/Tashkent")).strftime("%Y-%m-%d")

    try:
        prepare_questions(questions)
    except Exception as e:
        print("XATO:", e)
        return

    show_preview(questions)

    if not args.send:
        print("\nFaqat ko‘rib chiqish rejimi. Hozircha kanalga yuborilmadi.")
        return

    asyncio.run(send_batch(questions))


if __name__ == "__main__":
    main()