import os
import json

from dotenv import load_dotenv
from google import genai
from google.genai import types

from database import add_question, get_existing_questions
from image_sources import search_image, download_image


load_dotenv()

API_KEY = os.getenv("GEMINI_API_KEY")

if not API_KEY:
    raise ValueError("GEMINI_API_KEY topilmadi!")

client = genai.Client(
    api_key=API_KEY,
    http_options={"timeout": 120000}
)


def generate_image_question(category="Geografiya"):

    print("\nBILIMDON: Rasmli savol yaratilmoqda...")

    existing_questions = get_existing_questions(100)

    existing_text = "\n".join(
        f"- {q}" for q in existing_questions
    )

    prompt = f"""
    Sen BILIMDON loyihasining professional viktorina muharririsan.

    O'zbek tilida {category} fanidan bitta sifatli rasmli viktorina savoli yarat.

    AVVAL YARATILGAN SAVOLLAR:
    {existing_text}

    ASOSIY TALABLAR:
    - Faqat aniq va ishonchli faktlardan foydalan.
    - Bahsli, shubhali yoki tekshirilmagan da'volarni ishlatma.
    - Savol qisqa, ravon va tushunarli bo'lsin.
    - Savol imkon qadar 140 belgidan oshmasin.
    - O'quvchini qiziqtiradigan mavzuni tanla.
    - Avvalgi savollarni takrorlama.
    - Savol rasm bilan mazmunan mos bo'lsin.
    - 4 ta qisqa javob varianti yarat.
    - Faqat bitta javob to'g'ri bo'lsin.
    - Noto'g'ri javoblar ham mantiqan ishonarli bo'lsin.
    - To'g'ri javob variantlar ichida aynan mavjud bo'lsin.
    - image_query ingliz tilida bo'lsin.
    - Rasmda aynan savolga tegishli obyekt ko'rinishi kerak.
    - Kosmosdan ko'rinadi kabi bahsli iboralarni ishlatma.

    Faqat JSON qaytar:
    {{
        "question": "Qisqa va qiziqarli savol",
        "options": ["A javob", "B javob", "C javob", "D javob"],
        "correct_answer": "A javob",
        "image_query": "English image search phrase"
    }}
    """

    response = client.models.generate_content(
        model="gemini-3.5-flash-lite",
        contents=prompt,
        config=types.GenerateContentConfig(
            response_mime_type="application/json"
        )
    )

    if not response.text:
        print("Gemini bo'sh javob qaytardi!")
        return False

    try:
        data = json.loads(response.text)

        question = data["question"]
        options = data["options"]
        correct_answer = data["correct_answer"]
        image_query = data["image_query"]

        if not isinstance(options, list) or len(options) != 4:
            print("Javob variantlari noto'g'ri!")
            return False

        if correct_answer not in options:
            print("To'g'ri javob variantlarda yo'q!")
            return False

        if not image_query:
            print("Rasm qidiruv so'zi topilmadi!")
            return False

        print("\nSavol:", question)
        print("Rasm qidirilmoqda:", image_query)

        images = search_image(image_query)

        if not images:
            print("Mos litsenziyali rasm topilmadi!")
            return False

        image = images[0]

        print("Tanlangan rasm:", image["title"])
        print("Litsenziya:", image["license"])

        image_path = download_image(image)

        saved = add_question(
            question=question,
            options=options,
            correct_answer=correct_answer,
            category=category,
            image_path=image_path,
            image_source=image["source_url"],
            image_author=image.get("author"),
            image_license=image["license"]
        )

        if saved:
            print("\nRASMLI SAVOL BAZAGA SAQLANDI!")
            print("Savol:", question)
            print("Rasm:", image_path)

            for i, option in enumerate(options):
                print(f"{i + 1}. {option}")

            print("To'g'ri javob:", correct_answer)

        return saved

    except (json.JSONDecodeError, KeyError, TypeError) as e:
        print("Javobni o'qishda xatolik:", e)
        return False

    except Exception as e:
        print("Xatolik:", e)
        return False

if __name__ == "__main__":
    generate_image_question("Geografiya")