from flask import Flask, request, jsonify
from flask_cors import CORS
import mysql.connector
from mysql.connector import pooling
from contextlib import contextmanager
import os, uuid, datetime
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
CORS(app, origins="*")

@app.errorhandler(Exception)
def handle_exception(e):
    import traceback
    traceback.print_exc()
    return jsonify({"ok": False, "error": str(e)}), 500

@app.errorhandler(404)
def handle_404(e):
    return jsonify({"ok": False, "error": "rota não encontrada"}), 404

@app.errorhandler(405)
def handle_405(e):
    return jsonify({"ok": False, "error": "método não permitido"}), 405

DB_CONFIG = {
    "host":       os.getenv("WL_DB_HOST",     "localhost"),
    "port":       int(os.getenv("WL_DB_PORT", 3306)),
    "user":       os.getenv("WL_DB_USER",     "bibliotheca"),
    "password":   os.getenv("WL_DB_PASSWORD", ""),
    "database":   os.getenv("WL_DB_NAME",     "bibliotheca_wishlist"),
    "charset":    "utf8mb4",
    "use_unicode": True,
    "autocommit": False,
}

connection_pool = pooling.MySQLConnectionPool(
    pool_name="wl_pool",
    pool_size=5,
    **DB_CONFIG
)

@contextmanager
def get_db():
    conn   = connection_pool.get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        yield conn, cursor
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        # Consumir resultados pendentes para evitar "Unread result found"
        try:
            while cursor.nextset():
                pass
        except Exception:
            pass
        cursor.close()
        conn.close()

def gen_id() -> str:
    return "_wl" + uuid.uuid4().hex[:8]

def ok(data=None, status=200):
    return jsonify({"ok": True, "data": data}), status

def err(msg, status=400):
    return jsonify({"ok": False, "error": msg}), status

@app.get("/categories")
def list_categories():
    with get_db() as (_, cur):
        cur.execute("SELECT id, name FROM wl_categories ORDER BY name")
        return ok(cur.fetchall())

@app.post("/categories")
def create_category():
    body = request.get_json(silent=True) or {}
    name = (body.get("name") or "").strip()
    if not name:
        return err("name obrigatório")
    cat_id = name.lower().replace(" ", "_")[:32]
    with get_db() as (_, cur):
        cur.execute(
            "INSERT IGNORE INTO wl_categories (id, name) VALUES (%s, %s)",
            (cat_id, name)
        )
        cur.execute("SELECT id, name FROM wl_categories WHERE id = %s", (cat_id,))
        return ok(cur.fetchone(), 201)

@app.delete("/categories/<cat_id>")
def delete_category(cat_id):
    with get_db() as (_, cur):
        cur.execute("DELETE FROM wl_categories WHERE id = %s", (cat_id,))
        if cur.rowcount == 0:
            return err("categoria não encontrada", 404)
        return ok({"deleted": cat_id})

@app.get("/stores")
def list_stores():
    with get_db() as (_, cur):
        cur.execute("SELECT id, name, url_base FROM wl_stores ORDER BY name")
        return ok(cur.fetchall())

@app.post("/stores")
def create_store():
    body     = request.get_json(silent=True) or {}
    name     = (body.get("name") or "").strip()
    url_base = (body.get("url_base") or "").strip() or None
    if not name:
        return err("name obrigatório")
    with get_db() as (_, cur):
        cur.execute(
            "INSERT IGNORE INTO wl_stores (name, url_base) VALUES (%s, %s)",
            (name, url_base)
        )
        cur.execute("SELECT id, name, url_base FROM wl_stores WHERE name = %s", (name,))
        return ok(cur.fetchone(), 201)

ALLOWED_SORT = {
    "date-desc":  "added_at DESC",
    "date-asc":   "added_at ASC",
    "price-asc":  "price_est ASC",
    "price-desc": "price_est DESC",
    "title-asc":  "title ASC",
}

@app.get("/items")
def list_items():
    priority = request.args.get("priority", "")
    status   = request.args.get("status",   "")
    category = request.args.get("category", "")
    q        = request.args.get("q",        "").strip()
    sort     = ALLOWED_SORT.get(request.args.get("sort", "date-desc"), "added_at DESC")

    filters = []
    params  = []

    if priority in ("alta", "media", "baixa"):
        filters.append("priority = %s")
        params.append(priority)

    if status in ("desejo", "comprado"):
        filters.append("status = %s")
        params.append(status)

    if category:
        filters.append("category_id = %s")
        params.append(category)

    if q:
        filters.append("id IN (SELECT id FROM wl_items WHERE MATCH(title, author, notes) AGAINST(%s IN BOOLEAN MODE))")
        params.append(q + "*")

    where = ("WHERE " + " AND ".join(filters)) if filters else ""

    sql = f"""
        SELECT
          id, title, author,
          category_id, category_name,
          isbn, price_est, price_paid, savings,
          store_name,
          buy_link, priority, status, notes,
          added_at, updated_at, bought_at,
          price_min_ever, price_latest
        FROM v_wl_items
        {where}
        ORDER BY {sort}
    """

    with get_db() as (_, cur):
        cur.execute(sql, params)
        rows = cur.fetchall()
        # Serializar datas
        for r in rows:
            for k in ("added_at", "updated_at", "bought_at"):
                if r[k] and hasattr(r[k], "isoformat"):
                    r[k] = r[k].isoformat()
            for k in ("price_est", "price_paid", "savings", "price_min_ever", "price_latest"):
                if r[k] is not None:
                    r[k] = float(r[k])
        return ok(rows)

@app.get("/items/<item_id>")
def get_item(item_id):
    with get_db() as (_, cur):
        cur.execute("SELECT * FROM v_wl_items WHERE id = %s", (item_id,))
        row = cur.fetchone()
        if not row:
            return err("item não encontrado", 404)
        for k in ("added_at", "updated_at", "bought_at"):
            if row.get(k) and hasattr(row[k], "isoformat"):
                row[k] = row[k].isoformat()

        # Histórico de preços
        cur.execute("""
            SELECT ph.price, ph.recorded_at,
                   COALESCE(s.name, 'sem loja') AS store_name
            FROM wl_price_history ph
            LEFT JOIN wl_stores s ON s.id = ph.store_id
            WHERE ph.item_id = %s
            ORDER BY ph.recorded_at ASC
        """, (item_id,))
        history = cur.fetchall()
        for h in history:
            if h.get("recorded_at") and hasattr(h["recorded_at"], "isoformat"):
                h["recorded_at"] = h["recorded_at"].isoformat()
            h["price"] = float(h["price"])

        row["price_history"] = history
        return ok(row)

def _resolve_category(cursor, value):
    """Resolve category name or id to a valid wl_categories.id, or None."""
    if not value:
        return None
    val = str(value).strip()
    # Check if id exists directly
    cursor.execute("SELECT id FROM wl_categories WHERE id=%s", (val,))
    if cursor.fetchone():
        return val
    # Try matching by name (case-insensitive)
    cursor.execute("SELECT id FROM wl_categories WHERE LOWER(name)=LOWER(%s)", (val,))
    row = cursor.fetchone()
    if row:
        return row["id"]
    # Auto-create: generate id from name
    new_id = val.lower().replace(" ", "_")[:32]
    try:
        cursor.execute(
            "INSERT IGNORE INTO wl_categories (id, name) VALUES (%s, %s)",
            (new_id, val)
        )
    except Exception:
        pass
    return new_id


@app.post("/items")
def create_item():
    body = request.get_json(silent=True) or {}

    title = (body.get("title") or "").strip()
    if not title:
        return err("title obrigatório")

    priority = body.get("priority", "media")
    if priority not in ("alta", "media", "baixa"):
        priority = "media"

    status = body.get("status", "desejo")
    if status not in ("desejo", "comprado"):
        status = "desejo"

    price_est  = _parse_decimal(body.get("price_est"))
    price_paid = _parse_decimal(body.get("price_paid"))
    store_id   = _parse_int(body.get("store_id"))

    item_id = gen_id()

    with get_db() as (_, cur):
        category_id = _resolve_category(cur, body.get("category_id"))
        cur.execute("""
            INSERT INTO wl_items
              (id, title, author, category_id, isbn,
               price_est, price_paid, store_id, store_custom,
               buy_link, priority, status, notes)
            VALUES
              (%s, %s, %s, %s, %s,
               %s, %s, %s, %s,
               %s, %s, %s, %s)
        """, (
            item_id,
            title,
            (body.get("author") or "").strip() or None,
            category_id,
            (body.get("isbn") or "").strip() or None,
            price_est,
            price_paid,
            store_id,
            (body.get("store_custom") or "").strip() or None,
            (body.get("buy_link") or "").strip() or None,
            priority,
            status,
            (body.get("notes") or "").strip() or None,
        ))

        cur.execute("SELECT * FROM v_wl_items WHERE id = %s", (item_id,))
        row = cur.fetchone()
        _serialize_row(row)
        return ok(row, 201)

@app.put("/items/<item_id>")
def update_item(item_id):
    body = request.get_json(silent=True) or {}

    with get_db() as (_, cur):
        cur.execute("SELECT id FROM wl_items WHERE id = %s", (item_id,))
        if not cur.fetchone():
            return err("item não encontrado", 404)

        fields = {}

        if "title" in body:
            t = (body["title"] or "").strip()
            if not t:
                return err("title não pode ser vazio")
            fields["title"] = t

        for col in ("author", "isbn", "buy_link", "notes", "store_custom"):
            if col in body:
                fields[col] = (body[col] or "").strip() or None

        if "category_id" in body:
            fields["category_id"] = _resolve_category(cur, body["category_id"])

        if "priority" in body and body["priority"] in ("alta", "media", "baixa"):
            fields["priority"] = body["priority"]

        if "status" in body and body["status"] in ("desejo", "comprado"):
            fields["status"] = body["status"]
            # Gerencia bought_at aqui (não no trigger, para evitar MySQL erro 1442)
            fields["bought_at"] = "NOW()" if body["status"] == "comprado" else None

        if "price_est" in body:
            fields["price_est"] = _parse_decimal(body["price_est"])

        if "price_paid" in body:
            fields["price_paid"] = _parse_decimal(body["price_paid"])

        if "store_id" in body:
            fields["store_id"] = _parse_int(body["store_id"])

        if not fields:
            return err("nenhum campo para atualizar")

        set_parts = []
        values = []
        for k, v in fields.items():
            if v == "NOW()":
                set_parts.append(f"{k} = NOW()")
            else:
                set_parts.append(f"{k} = %s")
                values.append(v)
        set_clause = ", ".join(set_parts)
        values = values + [item_id]
        cur.execute(f"UPDATE wl_items SET {set_clause} WHERE id = %s", values)

        cur.execute("SELECT * FROM v_wl_items WHERE id = %s", (item_id,))
        row = cur.fetchone()
        _serialize_row(row)
        return ok(row)

@app.delete("/items/<item_id>")
def delete_item(item_id):
    with get_db() as (_, cur):
        cur.execute("SELECT id, title FROM wl_items WHERE id = %s", (item_id,))
        row = cur.fetchone()
        if not row:
            return err("item não encontrado", 404)
        cur.execute("DELETE FROM wl_items WHERE id = %s", (item_id,))
        return ok({"deleted": item_id, "title": row["title"]})

@app.get("/items/<item_id>/price-history")
def price_history(item_id):
    with get_db() as (_, cur):
        cur.execute("SELECT id FROM wl_items WHERE id = %s", (item_id,))
        if not cur.fetchone():
            return err("item não encontrado", 404)
        cur.execute("""
            SELECT ph.id, ph.price, ph.recorded_at,
                   COALESCE(s.name, '—') AS store_name
            FROM wl_price_history ph
            LEFT JOIN wl_stores s ON s.id = ph.store_id
            WHERE ph.item_id = %s
            ORDER BY ph.recorded_at ASC
        """, (item_id,))
        rows = cur.fetchall()
        for r in rows:
            if r.get("recorded_at") and hasattr(r["recorded_at"], "isoformat"):
                r["recorded_at"] = r["recorded_at"].isoformat()
            r["price"] = float(r["price"])
        return ok(rows)

@app.post("/items/<item_id>/price-history")
def add_price_entry(item_id):
    """Registrar preço manualmente (ex: pesquisou hoje e anotou)."""
    body  = request.get_json(silent=True) or {}
    price = _parse_decimal(body.get("price"))
    if price is None:
        return err("price obrigatório")
    store_id = _parse_int(body.get("store_id"))
    with get_db() as (_, cur):
        cur.execute("SELECT id FROM wl_items WHERE id = %s", (item_id,))
        if not cur.fetchone():
            return err("item não encontrado", 404)
        cur.execute(
            "INSERT INTO wl_price_history (item_id, price, store_id) VALUES (%s,%s,%s)",
            (item_id, price, store_id)
        )
        return ok({"item_id": item_id, "price": float(price)}, 201)

@app.get("/stats")
def stats():
    with get_db() as (_, cur):
        # Resumo geral
        cur.execute("SELECT * FROM v_wl_stats")
        summary = cur.fetchone()
        for k, v in summary.items():
            if v is not None and hasattr(v, "__float__"):
                summary[k] = float(v)

        # Por categoria
        cur.execute("SELECT * FROM v_wl_by_category")
        by_cat = cur.fetchall()
        for r in by_cat:
            if r.get("estimated_value") is not None:
                r["estimated_value"] = float(r["estimated_value"])

        # Itens comprados recentemente
        cur.execute("""
            SELECT id, title, author, price_paid, bought_at
            FROM wl_items
            WHERE status = 'comprado' AND bought_at IS NOT NULL
            ORDER BY bought_at DESC
            LIMIT 5
        """)
        recent_bought = cur.fetchall()
        for r in recent_bought:
            if r.get("bought_at") and hasattr(r["bought_at"], "isoformat"):
                r["bought_at"] = r["bought_at"].isoformat()
            if r.get("price_paid") is not None:
                r["price_paid"] = float(r["price_paid"])

        return ok({
            "summary":      summary,
            "by_category":  by_cat,
            "recent_bought": recent_bought,
        })

@app.get("/health")
def health():
    try:
        with get_db() as (_, cur):
            cur.execute("SELECT 1")
            cur.fetchone()
        return ok({"status": "ok", "database": "connected"})
    except Exception as e:
        return err(f"database error: {str(e)}", 503)

def _parse_decimal(val):
    if val is None or val == "":
        return None
    try:
        return round(float(val), 2)
    except (TypeError, ValueError):
        return None

def _parse_int(val):
    if val is None or val == "":
        return None
    try:
        return int(val)
    except (TypeError, ValueError):
        return None

def _serialize_row(row):
    if not row:
        return
    for k in ("added_at", "updated_at", "bought_at"):
        if row.get(k) and hasattr(row[k], "isoformat"):
            row[k] = row[k].isoformat()
    for k in ("price_est", "price_paid", "savings", "price_min_ever", "price_latest"):
        if row.get(k) is not None:
            row[k] = float(row[k])

if __name__ == "__main__":
    app.run(
        host  = os.getenv("WL_HOST",  "0.0.0.0"),
        port  = int(os.getenv("WL_PORT", 5001)),
        debug = os.getenv("WL_DEBUG", "false").lower() == "true"
    )
