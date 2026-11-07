import os
from dotenv import load_dotenv
from google import genai

# API kalitini yuklash
load_dotenv()

API_KEY = os.getenv("GEMINI_API_KEY")

if not API_KEY:
    print("XATOLIK: API kaliti topilmadi!")
    raise SystemExit

# Gemini bilan bog'lanish
client = genai.Client(
    api_key=API_KEY,
    http_options={"timeout": 120000}
)

print("Gemini bilan bog'lanmoqda...")

try:
    response = client.models.generate_content(
        model="gemini-3.5-flash-lite",
        contents="""
        O'zbek tilida geografiyadan bitta viktorina savoli yarat.
        4 ta javob varianti bo'lsin.
        To'g'ri javobni alohida ko'rsat.
        """
    )

    print("\nJAVOB:")
    print(response.text)

except Exception as e:
    print("\nXATOLIK:")
    print(e)