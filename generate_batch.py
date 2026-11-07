import argparse
import time
from datetime import datetime
from zoneinfo import ZoneInfo

from generate_question import generate_question
from generate_image_question import generate_image_question

categories = [
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
    parser.add_argument("--batch", type=int, required=True, choices=[1, 2, 3])
    args = parser.parse_args()

    total_saved = 0

    print(f"BILIMDON: {args.batch}-partiya tayyorlanmoqda...")

    for i in range(19):
        category = categories[i % len(categories)]
        print(f"\nOddiy savol {i + 1}/19: {category}")

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
        time.sleep(5)

    print("\nRasmli savol yaratilmoqda...")

    image_saved = generate_image_question("Geografiya")

    if image_saved:
        total_saved += 1

    print(f"\nJami saqlangan: {total_saved}/20")

    if total_saved == 20:
        from create_batch import main as create_batch_main
        print("Savollar yaratildi. Partiyani alohida tayyorlash kerak.")


if __name__ == "__main__":
    main()