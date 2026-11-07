import argparse
import time
from datetime import datetime
from zoneinfo import ZoneInfo

from generate_question import generate_question
from generate_image_question import generate_image_question
from database import assign_questions_to_batch


CATEGORIES = [
    "Geografiya",
    "Tarix",
    "Biologiya",
    "Fizika",
    "Kimyo",
    "Adabiyot",
    "Sport",
    "Texnologiya",
    "Umumiy bilimlar"
]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--batch",
        type=int,
        required=True,
        choices=[1, 2, 3]
    )
    args = parser.parse_args()

    total_saved = 0

    print(f"BILIMDON: {args.batch}-partiya tayyorlanmoqda...")

    # 19 ta oddiy savol yaratish
    for i in range(19):
        category = CATEGORIES[i % len(CATEGORIES)]

        print(f"\nSavol {i + 1}/19: {category}")

        saved = False

        for attempt in range(3):
            try:
                if generate_question(category):
                    total_saved += 1
                    saved = True
                    break
            except Exception as e:
                print("Xatolik:", e)

            if attempt < 2:
                time.sleep(5)

        if not saved:
            print("Savol yaratilmadi.")

        if i < 18:
            time.sleep(5)

    # 1 ta rasmli savol yaratish
    print("\nRasmli savol yaratilmoqda...")

    try:
        if generate_image_question("Geografiya"):
            total_saved += 1
    except Exception as e:
        print("Rasmli savolda xatolik:", e)

    print(f"\nJami saqlangan: {total_saved}/20")

    # Faqat 20 ta savol tayyor bo'lsa, partiyaga biriktirish
    if total_saved == 20:
        today = datetime.now(
            ZoneInfo("Asia/Tashkent")
        ).strftime("%Y-%m-%d")

        success = assign_questions_to_batch(
            today,
            args.batch
        )

        if success:
            print("Partiya muvaffaqiyatli biriktirildi!")
        else:
            print("Partiyani biriktirish amalga oshmadi.")
            raise SystemExit(1)
    else:
        print("20 ta savol to'liq tayyor bo'lmadi.")


if __name__ == "__main__":
    main()