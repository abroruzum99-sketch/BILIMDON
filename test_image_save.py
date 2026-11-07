from image_sources import search_image, download_image
from database import add_question

print("Baykal rasmi qidirilmoqda...")

images = search_image("Baikal lake")

if not images:
    print("Rasm topilmadi!")
    raise SystemExit

image = images[0]

if not image.get("license") or not image.get("source_url"):
    print("Rasm litsenziyasi yoki manbasi aniqlanmadi.")
    raise SystemExit

path = download_image(image)

saved = add_question(
    question="Baykal ko‘li qaysi davlat hududida joylashgan?",
    options=[
        "Rossiya",
        "Xitoy",
        "Qozog‘iston",
        "Mo‘g‘uliston"
    ],
    correct_answer="Rossiya",
    category="Geografiya",
    image_path=path,
    image_source=image["source_url"],
    image_author=image.get("author"),
    image_license=image["license"]
)

if saved:
    print("Rasmli savol bazaga muvaffaqiyatli saqlandi!")
else:
    print("Savol bazaga saqlanmadi.")