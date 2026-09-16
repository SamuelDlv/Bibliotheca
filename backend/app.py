from flask import Flask, request, jsonify, abort
from flask_cors import CORS
import mysql.connector
from mysql.connector import pooling
from contextlib import contextmanager
import os, uuid, datetime
from dotenv import load_dotenv
load_dotenv()

app = Flask(__name__)
CORS(app, origins="*")  # Em produção, restringir para a origem do frontend

DB_CONFIG = {
    "host":     os.getenv("DB_HOST",     "localhost"),
    "port":     int(os.getenv("DB_PORT", 3306)),
    "user":     os.getenv("DB_USER",     "bibliotheca"),
    "password": os.getenv("DB_PASSWORD", ""),
    "database": os.getenv("DB_NAME",     "bibliotheca"),
    "charset":  "utf8mb4",
    "use_unicode": True,
    "autocommit": False,
}

# Pool de conexões (mais eficiente que abrir/fechar por request)
connection_pool = pooling.MySQLConnectionPool(
    pool_name="bibliotheca_pool",
    pool_size=10,
    **DB_CONFIG
)

@contextmanager
def get_db():
    """Context manager para obter conexão do pool com transação automática."""
    conn = connection_pool.get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        yield conn, cursor
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        cursor.close()
        conn.close()

def gen_id() -> str:
    return "_" + uuid.uuid4().hex[:9]

def ok(data=None, status=200):
    return jsonify({"ok": True, "data": data}), status

def err(msg, status=400):
    return jsonify({"ok": False, "error": msg}), status

def add_activity(cursor, icon: str, text: str):
    cursor.execute(
        "INSERT INTO activity_feed (icon, text) VALUES (%s, %s)",
        (icon, text)
    )
    # Manter apenas os 30 mais recentes
    cursor.execute(
        "DELETE FROM activity_feed WHERE id NOT IN "
        "(SELECT id FROM (SELECT id FROM activity_feed ORDER BY created_at DESC LIMIT 30) t)"
    )

@app.get("/health")
def health():
    try:
        with get_db() as (conn, cur):
            cur.execute("SELECT 1")
        return ok({"status": "healthy"})
    except Exception as e:
        return err(str(e), 503)

@app.get("/settings")
def get_settings():
    with get_db() as (conn, cur):
        cur.execute("SELECT setting_key, setting_value FROM user_settings")
        rows = cur.fetchall()
    return ok({r["setting_key"]: r["setting_value"] for r in rows})

@app.patch("/settings")
def update_settings():
    data = request.get_json() or {}
    with get_db() as (conn, cur):
        for key, value in data.items():
            cur.execute(
                "INSERT INTO user_settings (setting_key, setting_value) VALUES (%s,%s) "
                "ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value)",
                (key, str(value))
            )
    return ok()

@app.get("/categories")
def list_categories():
    with get_db() as (conn, cur):
        cur.execute("SELECT * FROM categories ORDER BY name")
        return ok(cur.fetchall())

@app.post("/categories")
def create_category():
    d = request.get_json() or {}
    if not d.get("id") or not d.get("name"):
        return err("id e name são obrigatórios")
    with get_db() as (conn, cur):
        cur.execute(
            "INSERT INTO categories (id, name, color) VALUES (%s,%s,%s)",
            (d["id"], d["name"], d.get("color", "#7a8090"))
        )
    return ok(d, 201)

@app.delete("/categories/<cat_id>")
def delete_category(cat_id):
    with get_db() as (conn, cur):
        cur.execute("SELECT COUNT(*) AS cnt FROM books WHERE category_id=%s", (cat_id,))
        if cur.fetchone()["cnt"] > 0:
            return err("Categoria em uso por livros", 409)
        cur.execute("DELETE FROM categories WHERE id=%s", (cat_id,))
    return ok()

@app.patch("/categories/<cat_id>")
def update_category(cat_id):
    d = request.get_json() or {}
    color = d.get("color")
    if not color:
        return err("color é obrigatório")
    with get_db() as (conn, cur):
        cur.execute("UPDATE categories SET color=%s WHERE id=%s", (color, cat_id))
    return ok({"id": cat_id, "color": color})

@app.get("/authors")
def list_authors():
    with get_db() as (conn, cur):
        cur.execute("""
            SELECT a.*,
              GROUP_CONCAT(DISTINCT ac.concept ORDER BY ac.concept SEPARATOR ',') AS concepts
            FROM authors a
            LEFT JOIN author_concepts ac ON ac.author_id = a.id
            GROUP BY a.id
            ORDER BY a.name
        """)
        authors = cur.fetchall()

        # Buscar influências
        cur.execute("SELECT * FROM author_influences")
        influences = cur.fetchall()

    inf_by   = {}  # influenced_id -> [influencer names]
    inf_fwd  = {}  # influencer_id -> [influenced names]
    for row in influences:
        inf_by.setdefault(row["influenced_id"], []).append(row["influencer_id"])
        inf_fwd.setdefault(row["influencer_id"], []).append(row["influenced_id"])

    author_map = {a["id"]: a["name"] for a in authors}

    for a in authors:
        a["concepts"]     = [c for c in (a["concepts"] or "").split(",") if c]
        a["influencedBy"] = [author_map.get(x, x) for x in inf_by.get(a["id"], [])]
        a["influenced"]   = [author_map.get(x, x) for x in inf_fwd.get(a["id"], [])]

    return ok(authors)

@app.post("/authors")
def create_author():
    d = request.get_json() or {}
    if not d.get("name"):
        return err("name é obrigatório")
    aid = d.get("id") or gen_id()
    with get_db() as (conn, cur):
        cur.execute(
            "INSERT INTO authors (id, name, life, school, origin, bio) "
            "VALUES (%s,%s,%s,%s,%s,%s)",
            (aid, d["name"], d.get("life"), d.get("school"), d.get("origin"), d.get("bio"))
        )
        _save_author_relations(cur, aid, d)
        add_activity(cur, "◐", f"Autor \"{d['name']}\" cadastrado")
    d["id"] = aid
    return ok(d, 201)

@app.put("/authors/<author_id>")
def update_author(author_id):
    d = request.get_json() or {}
    with get_db() as (conn, cur):
        cur.execute(
            "UPDATE authors SET name=%s, life=%s, school=%s, origin=%s, bio=%s WHERE id=%s",
            (d.get("name"), d.get("life"), d.get("school"), d.get("origin"), d.get("bio"), author_id)
        )
        _save_author_relations(cur, author_id, d)
        add_activity(cur, "✏", f"Autor \"{d.get('name', '')}\" atualizado")
    return ok()

@app.delete("/authors/<author_id>")
def delete_author(author_id):
    with get_db() as (conn, cur):
        cur.execute("DELETE FROM authors WHERE id=%s", (author_id,))
    return ok()

def _save_author_relations(cursor, author_id, data):
    # Reconstruir conceitos
    cursor.execute("DELETE FROM author_concepts WHERE author_id=%s", (author_id,))
    for concept in data.get("concepts", []):
        if concept.strip():
            cursor.execute(
                "INSERT IGNORE INTO author_concepts (author_id, concept) VALUES (%s,%s)",
                (author_id, concept.strip())
            )
    # Influências são tratadas por nome -> resolver para ID
    # (simplificado: armazena nomes diretamente na busca reversa)

@app.get("/books")
def list_books():
    status  = request.args.get("status")
    cat     = request.args.get("category")
    search  = request.args.get("q")
    sort    = request.args.get("sort", "recent")

    query  = "SELECT * FROM v_book_summary WHERE 1=1"
    params = []

    if status and status != "all":
        query += " AND status = %s"; params.append(status)
    if cat and cat != "all":
        query += " AND category_id = %s"; params.append(cat)
    if search:
        query += " AND MATCH(title, author, quick_notes) AGAINST(%s IN BOOLEAN MODE)"
        params.append(f"{search}*")

    sort_map = {
        "title":    "title ASC",
        "author":   "author ASC",
        "progress": "progress_pct DESC",
        "recent":   "created_at DESC",
    }
    query += f" ORDER BY {sort_map.get(sort, 'created_at DESC')}"

    with get_db() as (conn, cur):
        cur.execute(query, params)
        books = cur.fetchall()

    for b in books:
        b["tags"] = [t for t in (b.get("tags") or "").split(",") if t]

    return ok(books)

@app.get("/books/<book_id>")
def get_book(book_id):
    with get_db() as (conn, cur):
        cur.execute("SELECT * FROM v_book_summary WHERE id=%s", (book_id,))
        book = cur.fetchone()
    if not book:
        return err("Livro não encontrado", 404)
    book["tags"] = [t for t in (book.get("tags") or "").split(",") if t]
    return ok(book)

@app.post("/books")
def create_book():
    d = request.get_json() or {}
    if not d.get("title") or not d.get("author"):
        return err("title e author são obrigatórios")

    bid = d.get("id") or gen_id()
    status = d.get("status", "futuro")
    completed_at = datetime.datetime.utcnow().isoformat() if status == "concluido" else None

    with get_db() as (conn, cur):
        cur.execute("""
            INSERT INTO books
              (id, title, author, category_id, status, total_pages, pages_read,
               year, quick_notes, before_read, review_days, era, completed_at)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
        """, (
            bid, d["title"], d["author"],
            d.get("category", d.get("category_id", "outro")),
            status,
            int(d.get("totalPages", d.get("total_pages", 0))),
            int(d.get("pagesRead",  d.get("pages_read",  0))),
            d.get("year"),
            d.get("quickNotes", d.get("quick_notes")),
            d.get("before", d.get("before_read")),
            d.get("reviewDays", d.get("review_days")),
            d.get("era"),
            completed_at
        ))
        _save_book_tags(cur, bid, d.get("tags", []))
        icon = "✓" if status == "concluido" else "◉" if status == "lendo" else "◷"
        add_activity(cur, icon, f"Adicionou \"{d['title']}\" por {d['author']}")

    return ok({"id": bid}, 201)

@app.put("/books/<book_id>")
def update_book(book_id):
    d = request.get_json() or {}
    with get_db() as (conn, cur):
        cur.execute("SELECT * FROM books WHERE id=%s", (book_id,))
        existing = cur.fetchone()
        if not existing:
            return err("Livro não encontrado", 404)

        status = d.get("status", existing["status"])
        if status == "concluido" and not existing["completed_at"]:
            completed_at = datetime.datetime.utcnow().isoformat()
        else:
            completed_at = existing["completed_at"]

        # Normalize empty strings to None for optional fields
        def norm(v):
            return v if v not in ('', None) else None

        cur.execute("""
            UPDATE books SET
              title=%s, author=%s, category_id=%s, status=%s,
              total_pages=%s, pages_read=%s, year=%s, quick_notes=%s,
              before_read=%s, review_days=%s, era=%s, completed_at=%s
            WHERE id=%s
        """, (
            d.get("title",   existing["title"]),
            d.get("author",  existing["author"]),
            d.get("category", d.get("category_id", existing["category_id"])),
            status,
            int(d.get("totalPages", d.get("total_pages", existing["total_pages"] or 0))),
            int(d.get("pagesRead",  d.get("pages_read",  existing["pages_read"]  or 0))),
            d.get("year", existing["year"]) or None,
            norm(d.get("quickNotes", d.get("quick_notes", existing["quick_notes"]))),
            norm(d.get("before",     d.get("before_read",  existing["before_read"]))),
            d.get("reviewDays", d.get("review_days", existing["review_days"])) or None,
            norm(d.get("era", existing["era"])),
            completed_at,
            book_id
        ))
        # Always update tags when provided
        tags = d.get("tags")
        if tags is not None:
            _save_book_tags(cur, book_id, tags)
        add_activity(cur, "✏", f"Editou \"{d.get('title', existing['title'])}\"")

    return ok()

@app.delete("/books/<book_id>")
def delete_book(book_id):
    with get_db() as (conn, cur):
        cur.execute("SELECT title FROM books WHERE id=%s", (book_id,))
        book = cur.fetchone()
        if not book:
            return err("Livro não encontrado", 404)
        cur.execute("DELETE FROM books WHERE id=%s", (book_id,))
        add_activity(cur, "✕", f"Removeu \"{book['title']}\"")
    return ok()

def _save_book_tags(cursor, book_id, tags):
    cursor.execute("DELETE FROM book_tags WHERE book_id=%s", (book_id,))
    for tag in tags:
        tag = tag.strip().lower()
        if tag:
            cursor.execute(
                "INSERT IGNORE INTO book_tags (book_id, tag) VALUES (%s,%s)",
                (book_id, tag)
            )
            cursor.execute(
                "INSERT IGNORE INTO global_tags (tag, color) VALUES (%s, %s)",
                (tag, '#7a8090')
            )

@app.get("/tags")
def list_tags():
    with get_db() as (conn, cur):
        cur.execute("SELECT tag, color FROM global_tags ORDER BY tag")
        return ok(cur.fetchall())

@app.post("/tags")
def create_tag():
    d = request.get_json() or {}
    tag = (d.get("tag") or "").strip().lower()
    if not tag:
        return err("tag é obrigatório")
    color = d.get("color", "#7a8090")
    with get_db() as (conn, cur):
        cur.execute(
            "INSERT INTO global_tags (tag, color) VALUES (%s,%s) "
            "ON DUPLICATE KEY UPDATE color=VALUES(color)",
            (tag, color)
        )
    return ok({"tag": tag, "color": color}, 201)

@app.patch("/tags/<tag>")
def update_tag(tag):
    d = request.get_json() or {}
    color = d.get("color")
    if not color:
        return err("color é obrigatório")
    with get_db() as (conn, cur):
        cur.execute("UPDATE global_tags SET color=%s WHERE tag=%s", (color, tag))
    return ok({"tag": tag, "color": color})

@app.delete("/tags/<tag>")
def delete_tag(tag):
    with get_db() as (conn, cur):
        cur.execute("SELECT COUNT(*) AS cnt FROM book_tags WHERE tag=%s", (tag,))
        if cur.fetchone()["cnt"] > 0:
            return err("Tag em uso por livros", 409)
        cur.execute("DELETE FROM global_tags WHERE tag=%s", (tag,))
    return ok()

@app.get("/notes")
def list_notes():
    book_id = request.args.get("book_id")
    with get_db() as (conn, cur):
        if book_id and book_id != "all":
            cur.execute("SELECT * FROM notes WHERE book_id=%s ORDER BY created_at DESC", (book_id,))
        else:
            cur.execute("SELECT * FROM notes ORDER BY created_at DESC")
        return ok(cur.fetchall())

@app.post("/notes")
def create_note():
    d = request.get_json() or {}
    if not d.get("bookId") and not d.get("book_id"):
        return err("book_id é obrigatório")
    book_id = d.get("bookId") or d.get("book_id")
    nid = d.get("id") or gen_id()

    with get_db() as (conn, cur):
        cur.execute("""
            INSERT INTO notes (id, book_id, quote, synthesis, impact, questions, practice, after_read)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s)
        """, (
            nid, book_id,
            d.get("quote"),
            d.get("synthesis"),
            d.get("impact"),
            d.get("questions"),
            d.get("practice"),
            d.get("after", d.get("after_read"))
        ))
        cur.execute("SELECT title FROM books WHERE id=%s", (book_id,))
        book = cur.fetchone()
        add_activity(cur, "✎", f"Anotação salva em \"{book['title'] if book else 'livro'}\"")

    return ok({"id": nid}, 201)

@app.put("/notes/<note_id>")
def update_note(note_id):
    d = request.get_json() or {}
    with get_db() as (conn, cur):
        cur.execute("""
            UPDATE notes SET quote=%s, synthesis=%s, impact=%s,
              questions=%s, practice=%s, after_read=%s
            WHERE id=%s
        """, (
            d.get("quote"), d.get("synthesis"), d.get("impact"),
            d.get("questions"), d.get("practice"),
            d.get("after", d.get("after_read")),
            note_id
        ))
    return ok()

@app.delete("/notes/<note_id>")
def delete_note(note_id):
    with get_db() as (conn, cur):
        cur.execute("DELETE FROM notes WHERE id=%s", (note_id,))
    return ok()

@app.get("/quotes")
def list_quotes():
    book_id = request.args.get("book_id")
    tag     = request.args.get("tag")

    query  = """
        SELECT q.*, GROUP_CONCAT(qt.tag ORDER BY qt.tag SEPARATOR ',') AS tags
        FROM quotes q
        LEFT JOIN quote_tags qt ON qt.quote_id = q.id
    """
    params = []
    where  = []

    if book_id and book_id != "all":
        where.append("q.book_id = %s"); params.append(book_id)
    if tag and tag != "all":
        where.append("q.id IN (SELECT quote_id FROM quote_tags WHERE tag=%s)")
        params.append(tag)

    if where:
        query += " WHERE " + " AND ".join(where)
    query += " GROUP BY q.id ORDER BY q.created_at DESC"

    with get_db() as (conn, cur):
        cur.execute(query, params)
        quotes = cur.fetchall()

    for q in quotes:
        q["tags"] = [t for t in (q.get("tags") or "").split(",") if t]
    return ok(quotes)

@app.post("/quotes")
def create_quote():
    d = request.get_json() or {}
    if not d.get("text"):
        return err("text é obrigatório")
    qid = d.get("id") or gen_id()
    book_id = d.get("bookId") or d.get("book_id") or None

    with get_db() as (conn, cur):
        cur.execute(
            "INSERT INTO quotes (id, text, book_id, reflection) VALUES (%s,%s,%s,%s)",
            (qid, d["text"], book_id, d.get("reflection"))
        )
        for tag in d.get("tags", []):
            if tag.strip():
                cur.execute(
                    "INSERT IGNORE INTO quote_tags (quote_id, tag) VALUES (%s,%s)",
                    (qid, tag.strip())
                )
        if book_id:
            cur.execute("SELECT title FROM books WHERE id=%s", (book_id,))
            book = cur.fetchone()
            add_activity(cur, "❝", f"Citação salva de \"{book['title'] if book else 'livro'}\"")

    return ok({"id": qid}, 201)

@app.put("/quotes/<quote_id>")
def update_quote(quote_id):
    d = request.get_json() or {}
    with get_db() as (conn, cur):
        cur.execute(
            "UPDATE quotes SET text=%s, book_id=%s, reflection=%s WHERE id=%s",
            (d.get("text"), d.get("bookId") or d.get("book_id"), d.get("reflection"), quote_id)
        )
        if "tags" in d:
            cur.execute("DELETE FROM quote_tags WHERE quote_id=%s", (quote_id,))
            for tag in d["tags"]:
                if tag.strip():
                    cur.execute(
                        "INSERT IGNORE INTO quote_tags (quote_id, tag) VALUES (%s,%s)",
                        (quote_id, tag.strip())
                    )
    return ok()

@app.delete("/quotes/<quote_id>")
def delete_quote(quote_id):
    with get_db() as (conn, cur):
        cur.execute("DELETE FROM quotes WHERE id=%s", (quote_id,))
    return ok()

@app.get("/diary")
def list_diary():
    with get_db() as (conn, cur):
        cur.execute("SELECT * FROM diary_entries ORDER BY entry_date DESC, created_at DESC")
        entries = cur.fetchall()
    for e in entries:
        if e.get("entry_date"):
            e["entry_date"] = str(e["entry_date"])
    return ok(entries)

@app.post("/diary")
def create_diary_entry():
    d = request.get_json() or {}
    eid = d.get("id") or gen_id()
    book_id = d.get("bookId") or d.get("book_id") or None

    with get_db() as (conn, cur):
        cur.execute("""
            INSERT INTO diary_entries (id, book_id, entry_date, pages_read, duration, mood, note)
            VALUES (%s,%s,%s,%s,%s,%s,%s)
        """, (
            eid, book_id,
            d.get("date", datetime.date.today().isoformat()),
            int(d.get("pages", 0)),
            int(d.get("duration", 0)),
            d.get("mood", "focado"),
            d.get("note")
        ))

        # Atualizar progresso do livro se fornecido
        if book_id and int(d.get("pages", 0)) > 0:
            cur.execute(
                "UPDATE books SET pages_read = LEAST(total_pages, pages_read + %s) WHERE id=%s",
                (int(d["pages"]), book_id)
            )
            # Marcar como concluído se atingiu total
            cur.execute("""
                UPDATE books SET status='concluido', completed_at=NOW()
                WHERE id=%s AND total_pages > 0 AND pages_read >= total_pages AND status != 'concluido'
            """, (book_id,))

        if book_id:
            cur.execute("SELECT title FROM books WHERE id=%s", (book_id,))
            book = cur.fetchone()
            add_activity(cur, "◷", f"Sessão registrada em \"{book['title'] if book else 'livro'}\"")

    return ok({"id": eid}, 201)

@app.delete("/diary/<entry_id>")
def delete_diary_entry(entry_id):
    with get_db() as (conn, cur):
        cur.execute("DELETE FROM diary_entries WHERE id=%s", (entry_id,))
    return ok()

@app.get("/vocabulary")
def list_vocabulary():
    search = request.args.get("q")
    with get_db() as (conn, cur):
        if search:
            cur.execute("""
                SELECT v.*, GROUP_CONCAT(vr.related_term ORDER BY vr.related_term SEPARATOR ',') AS related
                FROM vocabulary v
                LEFT JOIN vocab_related vr ON vr.vocab_id = v.id
                WHERE MATCH(v.term, v.definition, v.origin) AGAINST(%s IN BOOLEAN MODE)
                GROUP BY v.id ORDER BY v.term
            """, (f"{search}*",))
        else:
            cur.execute("""
                SELECT v.*, GROUP_CONCAT(vr.related_term ORDER BY vr.related_term SEPARATOR ',') AS related
                FROM vocabulary v
                LEFT JOIN vocab_related vr ON vr.vocab_id = v.id
                GROUP BY v.id ORDER BY v.term
            """)
        items = cur.fetchall()

    for item in items:
        item["related"] = [r for r in (item.get("related") or "").split(",") if r]
    return ok(items)

@app.post("/vocabulary")
def create_vocab():
    d = request.get_json() or {}
    if not d.get("term") or not d.get("definition"):
        return err("term e definition são obrigatórios")
    vid = d.get("id") or gen_id()

    with get_db() as (conn, cur):
        cur.execute(
            "INSERT INTO vocabulary (id, term, origin, definition, source) VALUES (%s,%s,%s,%s,%s)",
            (vid, d["term"], d.get("origin"), d["definition"], d.get("source"))
        )
        for rel in d.get("related", []):
            if rel.strip():
                cur.execute(
                    "INSERT IGNORE INTO vocab_related (vocab_id, related_term) VALUES (%s,%s)",
                    (vid, rel.strip())
                )
        add_activity(cur, "◬", f"Conceito \"{d['term']}\" adicionado ao vocabulário")

    return ok({"id": vid}, 201)

@app.put("/vocabulary/<vocab_id>")
def update_vocab(vocab_id):
    d = request.get_json() or {}
    with get_db() as (conn, cur):
        cur.execute(
            "UPDATE vocabulary SET term=%s, origin=%s, definition=%s, source=%s WHERE id=%s",
            (d.get("term"), d.get("origin"), d.get("definition"), d.get("source"), vocab_id)
        )
        if "related" in d:
            cur.execute("DELETE FROM vocab_related WHERE vocab_id=%s", (vocab_id,))
            for rel in d["related"]:
                if rel.strip():
                    cur.execute(
                        "INSERT IGNORE INTO vocab_related (vocab_id, related_term) VALUES (%s,%s)",
                        (vocab_id, rel.strip())
                    )
    return ok()

@app.delete("/vocabulary/<vocab_id>")
def delete_vocab(vocab_id):
    with get_db() as (conn, cur):
        cur.execute("DELETE FROM vocabulary WHERE id=%s", (vocab_id,))
    return ok()

@app.get("/lists")
def list_theme_lists():
    with get_db() as (conn, cur):
        cur.execute("""
            SELECT l.*,
              GROUP_CONCAT(lb.book_id ORDER BY lb.added_at SEPARATOR ',') AS book_ids
            FROM theme_lists l
            LEFT JOIN list_books lb ON lb.list_id = l.id
            GROUP BY l.id ORDER BY l.name
        """)
        lists = cur.fetchall()

    for lst in lists:
        lst["bookIds"] = [b for b in (lst.get("book_ids") or "").split(",") if b]
        lst.pop("book_ids", None)
    return ok(lists)

@app.post("/lists")
def create_list():
    d = request.get_json() or {}
    if not d.get("name"):
        return err("name é obrigatório")
    lid = d.get("id") or gen_id()

    with get_db() as (conn, cur):
        cur.execute(
            "INSERT INTO theme_lists (id, name, description) VALUES (%s,%s,%s)",
            (lid, d["name"], d.get("description"))
        )
        for book_id in d.get("bookIds", []):
            cur.execute(
                "INSERT IGNORE INTO list_books (list_id, book_id) VALUES (%s,%s)",
                (lid, book_id)
            )
        add_activity(cur, "◩", f"Lista \"{d['name']}\" criada")

    return ok({"id": lid}, 201)

@app.put("/lists/<list_id>")
def update_list(list_id):
    d = request.get_json() or {}
    with get_db() as (conn, cur):
        cur.execute(
            "UPDATE theme_lists SET name=%s, description=%s WHERE id=%s",
            (d.get("name"), d.get("description"), list_id)
        )
        if "bookIds" in d:
            cur.execute("DELETE FROM list_books WHERE list_id=%s", (list_id,))
            for book_id in d["bookIds"]:
                cur.execute(
                    "INSERT IGNORE INTO list_books (list_id, book_id) VALUES (%s,%s)",
                    (list_id, book_id)
                )
    return ok()

@app.delete("/lists/<list_id>")
def delete_list(list_id):
    with get_db() as (conn, cur):
        cur.execute("DELETE FROM theme_lists WHERE id=%s", (list_id,))
    return ok()

@app.get("/questions")
def list_questions():
    with get_db() as (conn, cur):
        cur.execute("SELECT * FROM open_questions ORDER BY resolved ASC, created_at DESC")
        return ok(cur.fetchall())

@app.post("/questions")
def create_question():
    d = request.get_json() or {}
    if not d.get("text"):
        return err("text é obrigatório")
    qid = gen_id()
    book_id = d.get("bookId") or d.get("book_id") or None

    with get_db() as (conn, cur):
        cur.execute(
            "INSERT INTO open_questions (id, text, book_id) VALUES (%s,%s,%s)",
            (qid, d["text"], book_id)
        )
        add_activity(cur, "?", "Nova pergunta registrada")

    return ok({"id": qid}, 201)

@app.patch("/questions/<question_id>/resolve")
def resolve_question(question_id):
    d = request.get_json() or {}
    with get_db() as (conn, cur):
        cur.execute(
            "UPDATE open_questions SET resolved=TRUE, answer=%s, resolved_at=NOW() WHERE id=%s",
            (d.get("answer"), question_id)
        )
    return ok()

@app.delete("/questions/<question_id>")
def delete_question(question_id):
    with get_db() as (conn, cur):
        cur.execute("DELETE FROM open_questions WHERE id=%s", (question_id,))
    return ok()

@app.get("/activity")
def list_activity():
    limit = int(request.args.get("limit", 30))
    with get_db() as (conn, cur):
        cur.execute(
            "SELECT * FROM activity_feed ORDER BY created_at DESC LIMIT %s", (limit,)
        )
        return ok(cur.fetchall())

@app.post("/notifications")
def create_notification():
    d = request.get_json() or {}
    if not d.get("title"):
        return err("title é obrigatório")
    with get_db() as (conn, cur):
        cur.execute(
            "INSERT INTO notifications (icon, title, message, book_id) VALUES (%s,%s,%s,%s)",
            (d.get("icon", "🔔"), d["title"], d.get("message", ""), d.get("bookId") or d.get("book_id"))
        )
    return ok({}, 201)

@app.get("/notifications")
def list_notifications():
    with get_db() as (conn, cur):
        cur.execute("SELECT * FROM notifications ORDER BY created_at DESC LIMIT 50")
        return ok(cur.fetchall())

@app.patch("/notifications/read-all")
def mark_notifications_read():
    with get_db() as (conn, cur):
        cur.execute("UPDATE notifications SET is_read=TRUE")
    return ok()

@app.delete("/notifications")
def clear_notifications():
    with get_db() as (conn, cur):
        cur.execute("DELETE FROM notifications")
    return ok()

@app.get("/dashboard")
def get_dashboard():
    with get_db() as (conn, cur):
        # Stats gerais
        cur.execute("SELECT * FROM v_dashboard_stats")
        stats = cur.fetchone()

        # Livros em leitura com progresso
        cur.execute("""
            SELECT id, title, author, category_id, progress_pct, pages_read, total_pages
            FROM v_book_summary WHERE status='lendo' ORDER BY created_at DESC
        """)
        reading = cur.fetchall()

        # Heatmap (conclusões por mês do ano atual)
        cur.execute("""
            SELECT month, books_completed FROM v_monthly_completions
            WHERE year = YEAR(NOW())
        """)
        heatmap = {r["month"]: r["books_completed"] for r in cur.fetchall()}

        # Revisões pendentes
        cur.execute("""
            SELECT id, title, author, completed_at, review_days,
              DATEDIFF(NOW(), DATE_ADD(completed_at, INTERVAL review_days DAY)) AS days_overdue
            FROM books
            WHERE status='concluido'
              AND review_days > 0
              AND completed_at IS NOT NULL
              AND DATE_ADD(completed_at, INTERVAL review_days DAY) <= NOW()
            ORDER BY days_overdue DESC
        """)
        reviews = cur.fetchall()

        # Feed de atividade
        cur.execute("SELECT * FROM activity_feed ORDER BY created_at DESC LIMIT 8")
        activity = cur.fetchall()

        # Breakdown por categoria
        cur.execute("""
            SELECT category_id, category_name, COUNT(*) AS total,
              SUM(status='concluido') AS done
            FROM v_book_summary GROUP BY category_id, category_name
            ORDER BY total DESC
        """)
        categories = cur.fetchall()

    return ok({
        "stats":       stats,
        "reading":     reading,
        "heatmap":     heatmap,
        "reviews":     reviews,
        "activity":    activity,
        "categories":  categories,
    })

@app.get("/search")
def global_search():
    q = request.args.get("q", "").strip()
    if not q or len(q) < 2:
        return err("query muito curta", 400)

    term = f"{q}*"
    with get_db() as (conn, cur):
        cur.execute("""
            SELECT 'book' AS type, id, title AS label, author AS sub
            FROM books WHERE MATCH(title, author, quick_notes) AGAINST(%s IN BOOLEAN MODE)
            LIMIT 5
        """, (term,))
        books = cur.fetchall()

        cur.execute("""
            SELECT 'note' AS type, n.id, b.title AS label, n.synthesis AS sub
            FROM notes n JOIN books b ON b.id = n.book_id
            WHERE MATCH(n.quote, n.synthesis, n.impact, n.questions, n.practice) AGAINST(%s IN BOOLEAN MODE)
            LIMIT 5
        """, (term,))
        notes = cur.fetchall()

        cur.execute("""
            SELECT 'vocab' AS type, id, term AS label, definition AS sub
            FROM vocabulary WHERE MATCH(term, definition, origin) AGAINST(%s IN BOOLEAN MODE)
            LIMIT 5
        """, (term,))
        vocab = cur.fetchall()

    return ok({"books": books, "notes": notes, "vocabulary": vocab})

if __name__ == "__main__":
    app.run(
        host=os.getenv("FLASK_HOST", "0.0.0.0"),
        port=int(os.getenv("FLASK_PORT", 5000)),
        debug=os.getenv("FLASK_DEBUG", "false").lower() == "true"
    )
