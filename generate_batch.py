import time
from generate_question import generate_question

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

total_saved = 0
target = 19

print("BILIMDON: 1-partiya tayyorlanmoqda...")

for i in range(target):
    print(f"\nSavol {i + 1}/{target}")

    saved = False

    for attempt in range(3):
        category = categories[i % len(categories)]

        try:
            if generate_question(category):
                total_saved += 1
                saved = True
                break

        except Exception as e:
            print("Xatolik:", e)

        if attempt < 2:
            print("7 soniya kutilyapti...")
            time.sleep(5)

    if not saved:
        print("Savol yaratilmadi.")

    # Har bir savoldan keyin API limitini hisobga olib kutish
    if i < target - 1:
        time.sleep(5)

print("\n========================")
print(f"Jami saqlangan: {total_saved}/19")
print("========================")