import os
import asyncio
import argparse
from datetime import datetime

from dotenv import load_dotenv
from telegram import Bot
from database import get_batch_questions, mark_question_sent

load_dotenv()

TOKEN = os.getenv("BOT_TOKEN")
CHANNEL_ID = os.getenv("CHANNEL_ID")

CATEGORY_EMOJIS = {
    "Geografiya": "🌍",
    "Tarix": "🏛️",
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
            f"Partiyada 20 ta savol bo'lishi kerak. Hozir: {len(questions)}"
        )

    normal = [q for q in questions if not q["image_path"]]
    images = [q for q in questions if q["image_path"]]

    if len(normal) != 19 or len(images) != 1:
        raise ValueError(
            f"19 ta oddiy va 1 ta rasmli savol kerak. "
            f"Hozir: {len(normal)} oddiy, {len(images)} rasmli."
        )

    for q in questions:
        if len(q["options"]) != 4:
            raise ValueError(
                f"4 ta javob varianti yo'q: {q['question']}"
            )

        correct = str(q["correct_answer"]).strip().casefold()
        options = [str(x).strip().casefold() for x in q["options"]]

        if correct not in options:
            raise ValueError(
                f"To'g'ri javob variantlarda topilmadi: {q['question']}"
            )

        if q["image_path"]:
            if not os.path.isfile(q["image_path"]):
                raise FileNotFoundError(
                    f"Rasm topilmadi: {q['image_path']}"
                )


def show_preview(questions):
    print("\nBILIMDON — PARTIYA TEKSHIRUVI")
    print("=" * 45)

    for i, q in enumerate(questions, 1):
        emoji = CATEGORY_EMOJIS.get(q["category"], "🧠")
        mark = "🖼️ RASMLI" if q["image_path"] else "ODDIY"

        print(f"\n{i}. [{mark}] {emoji} {q['question']}")

        for option in q["options"]:
            print("   •", option)

        print("   To'g'ri javob:", q["correct_answer"])

    print("\nJami:", len(questions), "ta savol")


async def send_batch(questions):
    bot = Bot(token=TOKEN)
    sent_count = 0
    skipped_count = 0

    await bot.initialize()

    try:
        for i, q in enumerate(questions, 1):
            if q["sent_at"]:
                print(f"{i}/20 — Avval yuborilgan, o'tkazib yuborildi.")
                skipped_count += 1
                continue

            emoji = CATEGORY_EMOJIS.get(q["category"], "🧠")
            question_text = f"{emoji} {q['question']}"

            options = [str(x) for x in q["options"]]

            correct = str(q["correct_answer"]).strip().casefold()
            correct_id = next(
                j for j, option in enumerate(options)
                if option.strip().casefold() == correct
            )

            if q["image_path"]:
                with open(q["image_path"], "rb") as photo:
                    await bot.send_photo(
                        chat_id=CHANNEL_ID,
                        photo=photo,
                        caption="🖼️ BILIMDON — Rasmli savol"
                    )

            await bot.send_poll(
                chat_id=CHANNEL_ID,
                question=question_text,
                options=options,
                type="quiz",
                correct_option_id=correct_id,
                is_anonymous=True,
                explanation=f"To'g'ri javob: {options[correct_id]}"
            )

            if mark_question_sent(q["id"]):
                sent_count += 1

            print(f"{i}/20 — Yuborildi: {q['question']}")

            await asyncio.sleep(4)

    finally:
        await bot.shutdown()

    print("\nYAKUN")
    print("Yuborildi:", sent_count)
    print("O'tkazib yuborildi:", skipped_count)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--batch", type=int, default=1)
    parser.add_argument("--send", action="store_true")
    args = parser.parse_args()
    if not TOKEN or not CHANNEL_ID:
        print("XATO: .env sozlamalarini tekshiring!")
        return

    today = datetime.now().strftime("%Y-%m-%d")

    print(f"BILIMDON: {args.batch}-partiya")
    print("Sana:", today)

    questions = get_batch_questions(today, args.batch)

    try:
        prepare_questions(questions)
    except Exception as e:
        print("TEKSHIRUV XATOSI:", e)
        return

    show_preview(questions)

    if not args.send:
        print("\nHozircha hech narsa Telegramga yuborilmadi.")
        print("Tekshiruvdan keyin yuborish uchun:")
        print(f"python send_batch.py --batch {args.batch} --send")
        return

    print("\nTelegramga yuborish boshlandi...")
    asyncio.run(send_batch(questions))


if __name__ == "__main__":
    main()