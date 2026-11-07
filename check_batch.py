import sqlite3

conn = sqlite3.connect("bilimdon.db")
cursor = conn.cursor()

cursor.execute("""
    SELECT
        COUNT(*) AS jami,
        SUM(CASE WHEN image_path IS NULL THEN 1 ELSE 0 END) AS null_son,
        SUM(CASE WHEN image_path = '' THEN 1 ELSE 0 END) AS bosh_son,
        SUM(CASE WHEN image_path IS NOT NULL
            AND image_path != '' THEN 1 ELSE 0 END) AS rasmli_son
    FROM questions
""")

row = cursor.fetchone()

print("Jami savollar:", row[0])
print("image_path NULL:", row[1])
print("image_path bo'sh:", row[2])
print("image_path rasmli:", row[3])

print("\nimage_path qiymatlari:")
cursor.execute("""
    SELECT image_path, COUNT(*)
    FROM questions
    GROUP BY image_path
""")

for item in cursor.fetchall():
    print(repr(item[0]), "—", item[1], "ta")

conn.close()