import os
import sqlite3
import json
from dotenv import load_dotenv
from telegram import Bot

load_dotenv()

TOKEN = os.getenv("BOT_TOKEN")
CHANNEL_ID = os.getenv("CHANNEL_ID")


async def main():
    if not TOKEN or not CHANNEL_ID:
        print("BOT_TOKEN yoki CHANNEL_ID topilmadi!")
        return

    conn = sqlite3.connect("bilimdon.db")
    cursor = conn.cursor()

    cursor.execute("""
        SELECT question, options, correct_answer,
               image_path, image_license
        FROM questions
        WHERE image_path IS NOT NULL
        ORDER BY id DESC
        LIMIT 1
    """)

    row = cursor.fetchone()
    conn.close()

    if not row:
        print("Rasmli savol topilmadi!")
        return

    question, options, correct, image_path, license_name = row
    options = json.loads(options)

    if not os.path.exists(image_path):
        print("Rasm fayli topilmadi:", image_path)
        return

    if correct not in options:
        print("To'g'ri javob variantlarda mavjud emas!")
        return

    # Faqat atributsiya talab qilmaydigan litsenziyalar
    license_text = (license_name or "").lower()

    allowed = (
        "cc0" in license_text
        or "public domain" in license_text
    )

    if not allowed:
        print("Bu rasm litsenziyasi kanalga atributsiyasiz joylash uchun mos emas!")
        print("Litsenziya:", license_name)
        return

    correct_id = options.index(correct)

    caption = (
        "🧠 BILIMDON VIKTORINASI\n\n"
        "🌍 " + question +
        "\n\n🤔 Sizning javobingiz qanday?"
    )

    bot = Bot(TOKEN)

    async with bot:
        with open(image_path, "rb") as photo:
            await bot.send_photo(
                chat_id=CHANNEL_ID,
                photo=photo,
                caption=caption
            )

        await bot.send_poll(
            chat_id=CHANNEL_ID,
            question="🧠 " + question,
            options=options,
            type="quiz",
            correct_option_ids=[correct_id],
            explanation="🎉 To'g'ri javob: " + correct,
            is_anonymous=True
        )

    print("Rasmli viktorina kanalga joylandi!")


if __name__ == "__main__":
    import asyncio
    asyncio.run(main())