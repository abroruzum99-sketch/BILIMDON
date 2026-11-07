import os
import re
import requests

API_URL = "https://commons.wikimedia.org/w/api.php"

HEADERS = {
    "User-Agent": "BILIMDONQuizBot/1.0 (Educational project)"
}


def search_image(query):
    params = {
        "action": "query",
        "generator": "search",
        "gsrsearch": f"filetype:bitmap {query}",
        "gsrnamespace": 6,
        "gsrlimit": 100,
        "prop": "imageinfo",
        "iiprop": "url|extmetadata",
        "iiurlwidth": 1200,
        "format": "json"
    }

    response = requests.get(
        API_URL,
        params=params,
        headers=HEADERS,
        timeout=30
    )

    response.raise_for_status()
    data = response.json()

    pages = data.get("query", {}).get("pages", {})
    results = []

    for page in pages.values():
        image_info = page.get("imageinfo", [{}])[0]
        metadata = image_info.get("extmetadata", {})

        license_name = metadata.get(
            "LicenseShortName", {}
        ).get("value", "")

        license_lower = license_name.lower().strip()

        # Faqat CC0 va Public Domain
        allowed = (
            "cc0" in license_lower
            or "public domain" in license_lower
            or "pdm" in license_lower
            or "cc-zero" in license_lower
        )

        if not allowed:
            continue

        image_url = image_info.get(
            "thumburl",
            image_info.get("url")
        )

        source_url = image_info.get("descriptionurl")

        if not image_url or not source_url:
            continue

        results.append({
            "title": page.get("title"),
            "url": image_url,
            "source_url": source_url,
            "license": license_name,
            "author": metadata.get(
                "Artist", {}
            ).get("value", "")
        })

    return results


def download_image(image, folder="images"):
    os.makedirs(folder, exist_ok=True)

    filename = image["title"].replace("File:", "")
    filename = re.sub(r'[<>:"/\\|?*]', "_", filename)

    path = os.path.join(folder, filename)

    response = requests.get(
        image["url"],
        headers=HEADERS,
        timeout=60
    )

    response.raise_for_status()

    with open(path, "wb") as file:
        file.write(response.content)

    print("Rasm yuklandi:", path)

    return path


if __name__ == "__main__":
    print("CC0 va Public Domain rasmlari qidirilmoqda...")

    try:
        images = search_image("Baikal lake")

        print("Mos rasmlar soni:", len(images))

        if images:
            image = images[0]

            print("Tanlangan rasm:", image["title"])
            print("Litsenziya:", image["license"])

            download_image(image)

        else:
            print("Mos litsenziyali rasm topilmadi.")

    except Exception as e:
        print("Xatolik:", e)