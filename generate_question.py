import os
import json
from dotenv import load_dotenv
from google import genai
from google.genai import types
from database import add_question, get_existing_questions

load_dotenv()

API_KEY = os.getenv("GEMINI_API_KEY")

if not API_KEY:
    raise ValueError("GEMINI_API_KEY topilmadi!")

client = genai.Client(
    api_key=API_KEY,
    http_options={"timeout": 120000}
)


def generate_question(category="Umumiy bilimlar"):

    existing_questions = get_existing_questions(100)

    existing_text = "\n".join(
        f"- {q}" for q in existing_questions
    )

    prompt = f"""
    O'zbek tilida {category} fanidan bitta yangi viktorina savoli yarat.

    AVVAL YARATILGAN SAVOLLAR:
    {existing_text}

    TALABLAR:
    - Yuqoridagi savollarni takrorlama.
    - Mazmunan o'xshash savol yaratma.
    - Yangi mavzu va faktni tanla.
    - 4 ta javob varianti bo'lsin.
    - Faqat bitta javob to'g'ri bo'lsin.
    - To'g'ri javob options ichida aynan mavjud bo'lsin.

    Faqat JSON qaytar:
    {{
        "question": "Savol matni",
        "options": ["A javob", "B javob", "C javob", "D javob"],
        "correct_answer": "A javob"
    }}
    """

    response = client.models.generate_content(
        model="gemini-3.5-flash-lite",
        contents=prompt,
        config=types.GenerateContentConfig(
            response_mime_type="application/json"
        )
    )

    raw_text = response.text

    if not raw_text:
        print("Gemini bo'sh javob qaytardi!")
        return False

    try:
        data = json.loads(raw_text)

        question = data["question"]
        options = data["options"]
        correct_answer = data["correct_answer"]

        if not isinstance(options, list) or len(options) != 4:
            print("Javob variantlari noto'g'ri!")
            return False

        if correct_answer not in options:
            print("To'g'ri javob variantlarda yo'q!")
            return False

        saved = add_question(
            question=question,
            options=options,
            correct_answer=correct_answer,
            category=category
        )

        if saved:
            print("\nYANGI SAVOL:")
            print(question)

            for i, option in enumerate(options):
                print(f"{i + 1}. {option}")

            print("To'g'ri javob:", correct_answer)

        return saved

    except (json.JSONDecodeError, KeyError, TypeError) as e:
        print("Javobni o'qishda xatolik:", e)
        return False


if __name__ == "__main__":
    generate_question("Geografiya")