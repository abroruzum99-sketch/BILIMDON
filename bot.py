import os
from dotenv import load_dotenv
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import (
    Application,
    CommandHandler,
    CallbackQueryHandler,
    PollAnswerHandler,
    ContextTypes
)

from database import (
    get_question_by_id,
    get_question_by_poll_id,
    save_answer
)

load_dotenv()

TOKEN = os.getenv("BOT_TOKEN")
CHANNEL_ID = os.getenv("CHANNEL_ID")


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = update.effective_user

    await update.message.reply_text(
        f"Assalomu alaykum, {user.first_name}! 👋\n\n"
        "BILIMDON viktorinasiga xush kelibsiz! 🧠\n"
        "Javoblaringiz va shaxsiy natijalaringiz shu bot orqali qayd etiladi. 🏆"
    )


async def quiz(update: Update, context: ContextTypes.DEFAULT_TYPE):
    try:
        member = await context.bot.get_chat_member(
            CHANNEL_ID, update.effective_user.id
        )

        if member.status not in ("administrator", "creator"):
            await update.message.reply_text(
                "Bu buyruq faqat kanal adminlari uchun."
            )
            return

        keyboard = [
            [InlineKeyboardButton("A. Samarqand", callback_data="demo:0")],
            [InlineKeyboardButton("B. Toshkent", callback_data="demo:1")],
            [InlineKeyboardButton("C. Buxoro", callback_data="demo:2")],
            [InlineKeyboardButton("D. Xiva", callback_data="demo:3")]
        ]

        await context.bot.send_message(
            chat_id=CHANNEL_ID,
            text="🇺🇿 O‘zbekiston poytaxti qaysi shahar?",
            reply_markup=InlineKeyboardMarkup(keyboard)
        )

        await update.message.reply_text(
            "Sinov savoli kanalga yuborildi!"
        )

    except Exception as e:
        print(f"Quiz xatosi: {e}")
        await update.message.reply_text(f"Xatolik: {e}")


async def answer_callback(
    update: Update,
    context: ContextTypes.DEFAULT_TYPE
):
    query = update.callback_query
    user = query.from_user

    try:
        if not query.data:
            await query.answer("Noto‘g‘ri tugma!", show_alert=True)
            return

        # Sinov savoli javoblari
        if query.data.startswith("demo:"):
            selected = int(query.data.split(":")[1])

            if selected not in range(4):
                await query.answer("Noto‘g‘ri javob varianti!", show_alert=True)
                return

            if selected == 1:
                await query.answer("To‘g‘ri javob! ✅")
            else:
                await query.answer("Noto‘g‘ri javob! ❌")

            return

        # Haqiqiy savollar javoblari
        data = query.data.split(":")

        if len(data) != 3 or data[0] != "ans":
            await query.answer("Noto‘g‘ri tugma!", show_alert=True)
            return

        question_id = int(data[1])
        selected_option = int(data[2])

        question = get_question_by_id(question_id)

        if question is None or selected_option not in range(4):
            await query.answer(
                "Savol yoki javob topilmadi!",
                show_alert=True
            )
            return

        if question["batch_date"] is None:
            await query.answer(
                "Test savoli: javob qayd etilmadi.",
                show_alert=True
            )
            return

        save_answer(
            user_id=user.id,
            first_name=user.first_name,
            username=user.username,
            question_id=question_id,
            batch_date=question["batch_date"],
            batch_number=question["batch_number"],
            selected_option=selected_option,
            options=question["options"],
            correct_answer=question["correct_answer"]
        )

        await query.answer("Javobingiz qabul qilindi! ✅")

    except Exception as e:
        print(f"Tugmali javob xatosi: {e}")
        await query.answer("Xatolik yuz berdi!", show_alert=True)
async def poll_answer_callback(
    update: Update,
    context: ContextTypes.DEFAULT_TYPE
):
    answer = update.poll_answer

    if not answer or not answer.option_ids:
        return

    try:
        question = get_question_by_poll_id(answer.poll_id)

        if question is None:
            print("So‘rovnoma bazadan topilmadi:", answer.poll_id)
            return

        user = answer.user
        selected_option = answer.option_ids[0]

        if question["batch_date"] is None:
            print("Test so‘rovnomasi: javob qayd etilmadi.")
            return

        save_answer(
            user_id=user.id,
            first_name=user.first_name,
            username=user.username,
            question_id=question["id"],
            batch_date=question["batch_date"],
            batch_number=question["batch_number"],
            selected_option=selected_option,
            options=question["options"],
            correct_answer=question["correct_answer"]
        )

        print(f"So‘rovnoma javobi saqlandi: {user.id}")

    except Exception as e:
        print(f"So‘rovnoma javobi xatosi: {e}")


def main():
    if not TOKEN or not CHANNEL_ID:
        print(".env sozlamalarini tekshiring!")
        return

    app = Application.builder().token(TOKEN).build()

    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler("quiz", quiz))
    app.add_handler(CallbackQueryHandler(answer_callback))
    app.add_handler(PollAnswerHandler(poll_answer_callback))

    print("BILIMDON bot ishga tushdi!")

    if os.getenv("RENDER"):
        external_url = os.getenv("RENDER_EXTERNAL_URL")
        webhook_secret = os.getenv("WEBHOOK_SECRET")

        if not external_url or not webhook_secret:
            raise RuntimeError("Render webhook sozlamalari topilmadi!")

        app.run_webhook(
            listen="0.0.0.0",
            port=int(os.getenv("PORT", "10000")),
            url_path=webhook_secret,
            webhook_url=f"{external_url}/{webhook_secret}",
            secret_token=webhook_secret
        )
    else:
        app.run_polling()


if __name__ == "__main__":
    main()