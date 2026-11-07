import os
print("DATABASE JOYLASHUVI:", os.path.abspath("bilimdon.db"))
from datetime import datetime

from database import (
    assign_questions_to_batch,
    get_batch_questions
)

today = datetime.now().strftime("%Y-%m-%d")
batch_number = 1

print("BILIMDON: 1-partiya shakllantirilmoqda...")

success = assign_questions_to_batch(
    today,
    batch_number
)

if success:
    questions = get_batch_questions(today, batch_number)

    print("\nPARTIYA TEKSHIRUVI")
    print("===================")

    for i, q in enumerate(questions, 1):
        mark = "🖼️" if q["image_path"] else "🧠"

        print(f"\n{i}. {mark} {q['question']}")

    print("\nJami savollar:", len(questions))
    print("Partiya tayyor! 🚀")
else:
    print("Partiyani shakllantirish amalga oshmadi.")