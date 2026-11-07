import os
from dotenv import load_dotenv
from telegram import Update
from telegram.ext import Application, CommandHandler, ContextTypes

load_dotenv()

TOKEN = os.getenv("BOT_TOKEN")
CHANNEL_ID = os.getenv("CHANNEL_ID")


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        "Assalomu alaykum! 👋\n"
        "BILIMDON viktorinasiga xush kelibsiz! 🧠"
    )


async def quiz(update: Update, context: ContextTypes.DEFAULT_TYPE):
    try:
        member = await context.bot.get_chat_member(
            CHANNEL_ID, update.effective_user.id
        )

        if member.status not in ("administrator", "creator"):
            await update.message.reply_text("Bu buyruq faqat kanal adminlari uchun.")
            return

        await context.bot.send_poll(
            chat_id=CHANNEL_ID,
            question="🇺🇿 O‘zbekiston poytaxti qaysi shahar?",
            options=["Samarqand", "Toshkent", "Buxoro", "Xiva"],
            type="quiz",
            correct_option_id=1,
            explanation="To‘g‘ri javob — Toshkent! 🇺🇿",
            is_anonymous=True
        )

        await update.message.reply_text("✅ Viktorina kanalga joylandi!")

    except Exception as e:
        await update.message.reply_text(f"Xatolik: {e}")


def main():
    if not TOKEN or not CHANNEL_ID:
        print("XATO: .env sozlamalarini tekshiring!")
        return

    app = Application.builder().token(TOKEN).build()

    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler("quiz", quiz))

    print("BILIMDON bot ishga tushdi!")
    app.run_polling()

if __name__ == "__main__":
    main()