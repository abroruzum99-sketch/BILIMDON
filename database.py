import sqlite3
import json

DB_NAME = "bilimdon.db"


def create_database():
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS questions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            question TEXT NOT NULL UNIQUE,
            options TEXT NOT NULL,
            correct_answer TEXT NOT NULL,
            category TEXT,
            image_path TEXT,
            image_source TEXT,
            image_author TEXT,
            image_license TEXT,
            batch_date TEXT,
            batch_number INTEGER,
            sent_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    cursor.execute("PRAGMA table_info(questions)")
    columns = [row[1] for row in cursor.fetchall()]

    new_columns = {
        "image_source": "TEXT",
        "image_author": "TEXT",
        "image_license": "TEXT",
        "batch_date": "TEXT",
        "batch_number": "INTEGER",
        "sent_at": "TIMESTAMP"
    }

    for column, data_type in new_columns.items():
        if column not in columns:
            cursor.execute(
                f"ALTER TABLE questions ADD COLUMN {column} {data_type}"
            )

    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_batch
        ON questions(batch_date, batch_number)
    """)

    conn.commit()
    conn.close()


def question_exists(question):
    question = " ".join(question.split()).casefold()

    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    cursor.execute("SELECT question FROM questions")
    rows = cursor.fetchall()
    conn.close()

    for row in rows:
        saved = " ".join(row[0].split()).casefold()
        if saved == question:
            return True

    return False


def add_question(
    question,
    options,
    correct_answer,
    category="Umumiy",
    image_path=None,
    image_source=None,
    image_author=None,
    image_license=None
):
    if question_exists(question):
        print("Bu savol avval mavjud!")
        return False

    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()

    try:
        cursor.execute("""
            INSERT INTO questions (
                question, options, correct_answer, category,
                image_path, image_source, image_author, image_license
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            question, json.dumps(options, ensure_ascii=False),
            correct_answer, category, image_path,
            image_source, image_author, image_license
        ))

        conn.commit()
        print("Savol bazaga saqlandi!")
        return True

    except sqlite3.IntegrityError:
        print("Bu savol bazada mavjud!")
        return False

    finally:
        conn.close()


def get_existing_questions(limit=100):
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()

    cursor.execute("""
        SELECT question FROM questions
        ORDER BY id DESC LIMIT ?
    """, (limit,))

    rows = cursor.fetchall()
    conn.close()
    return [row[0] for row in rows]


def assign_questions_to_batch(batch_date, batch_number):
    if batch_number not in (1, 2, 3):
        print("Partiya raqami 1, 2 yoki 3 bo'lishi kerak!")
        return False

    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()

    try:
        cursor.execute("BEGIN IMMEDIATE")

        cursor.execute("""
            SELECT COUNT(*) FROM questions
            WHERE batch_date = ? AND batch_number = ?
        """, (batch_date, batch_number))

        if cursor.fetchone()[0] > 0:
            print("Bu partiya avval shakllantirilgan!")
            conn.rollback()
            return False

        cursor.execute("""
            SELECT id FROM questions
            WHERE batch_date IS NULL
            AND (image_path IS NULL OR image_path = '')
            ORDER BY id LIMIT 19
        """)

        normal_ids = [row[0] for row in cursor.fetchall()]
        cursor.execute("""
            SELECT id FROM questions
            WHERE batch_date IS NULL
            AND image_path IS NOT NULL
            AND image_path != ''
            ORDER BY id LIMIT 1
        """)

        image_row = cursor.fetchone()

        if len(normal_ids) < 19 or image_row is None:
            print("Partiya uchun savollar yetarli emas!")
            print("Oddiy savollar:", len(normal_ids), "/19")
            print("Rasmli savol:", "1/1" if image_row else "0/1")
            conn.rollback()
            return False

        all_ids = normal_ids + [image_row[0]]

        cursor.executemany("""
            UPDATE questions
            SET batch_date = ?, batch_number = ?
            WHERE id = ?
        """, [
            (batch_date, batch_number, qid)
            for qid in all_ids
        ])

        conn.commit()

        print(f"{batch_number}-partiya tayyor!")
        print("Jami savollar: 20")
        print("Oddiy savollar: 19")
        print("Rasmli savollar: 1")
        return True

    except Exception as e:
        conn.rollback()
        print("Partiya yaratishda xatolik:", e)
        return False

    finally:
        conn.close()


def get_batch_questions(batch_date, batch_number):
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    cursor.execute("""
        SELECT * FROM questions
        WHERE batch_date = ? AND batch_number = ?
        ORDER BY
            CASE WHEN image_path IS NULL OR image_path = ''
            THEN 0 ELSE 1 END,
            id
    """, (batch_date, batch_number))

    rows = cursor.fetchall()
    conn.close()

    result = []

    for row in rows:
        item = dict(row)
        item["options"] = json.loads(item["options"])
        result.append(item)

    return result


def mark_question_sent(question_id):
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()

    cursor.execute("""
        UPDATE questions
        SET sent_at = CURRENT_TIMESTAMP
        WHERE id = ? AND sent_at IS NULL
    """, (question_id,))

    updated = cursor.rowcount
    conn.commit()
    conn.close()
    return updated == 1


if __name__ == "__main__":
    create_database()
    print("BILIMDON bazasi tayyor!")