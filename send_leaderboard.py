import os
from datetime import datetime
from zoneinfo import ZoneInfo

from dotenv import load_dotenv
from telegram import Bot

from database import get_daily_leaderboard

load_dotenv()

TOKEN = os.getenv("BOT_TOKEN")
CHANNEL_ID = os.getenv("CHANNEL_ID")


async def main():
    today = datetime.now(
        ZoneInfo("Asia/Tashkent")
    ).strftime("%Y-%m-%d")

    results = get_daily_leaderboard(today)

    if not results:
        print("Bugun reyting uchun natijalar yo‘q.")
        return

    medals = ["🥇", "🥈", "🥉"]

    lines = [
        "🏆 BILIMDON — KUNLIK TOP-3",
        "",
        f"📅 Sana: {today}",
        ""
    ]

    for i, row in enumerate(results[:3]):
        username, total, correct, wrong, percent = row

        lines.append(
            f"{medals[i]} {username}\n"
            f"✅ To‘g‘ri: {correct} | ❌ Noto‘g‘ri: {wrong}\n"
            f"📊 Natija: {percent}%"
        )

    lines.append("\n👏 Barcha ishtirokchilarga rahmat!")

    bot = Bot(token=TOKEN)

    async with bot:
        await bot.send_message(
            chat_id=CHANNEL_ID,
            text="\n".join(lines),
            parse_mode="Markdown"
        )

    print("TOP-3 reyting kanalga yuborildi!")


if __name__ == "__main__":
    import asyncio
    asyncio.run(main())