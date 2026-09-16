"""
BIBLIOTHECA WISHLIST — Setup do Banco de Dados
Executa o schema.sql para criar/atualizar o banco bibliotheca_wishlist.

Uso:
  python setup_db.py

Requer o arquivo .env configurado (copie de .env.example).
"""

import os, sys
from dotenv import load_dotenv
import mysql.connector

load_dotenv()

def run():
    # Conexão sem selecionar banco ainda (o schema cria o banco se não existir)
    conn = mysql.connector.connect(
        host     = os.getenv("WL_DB_HOST",     "localhost"),
        port     = int(os.getenv("WL_DB_PORT", 3306)),
        user     = os.getenv("WL_DB_USER",     "bibliotheca"),
        password = os.getenv("WL_DB_PASSWORD", ""),
        charset  = "utf8mb4",
    )

    schema_path = os.path.join(os.path.dirname(__file__), "schema.sql")
    if not os.path.exists(schema_path):
        print(f"[ERRO] schema.sql não encontrado em {schema_path}")
        sys.exit(1)

    with open(schema_path, "r", encoding="utf-8") as f:
        sql = f.read()

    cursor = conn.cursor()

    # Dividir em statements individuais (respeitando DELIMITER$$)
    statements = _split_sql(sql)
    success = 0
    skipped = 0

    for stmt in statements:
        stmt = stmt.strip()
        if not stmt:
            continue
        try:
            cursor.execute(stmt)
            conn.commit()
            success += 1
        except mysql.connector.Error as e:
            # Ignorar erros de "já existe" (idempotente)
            if e.errno in (1050, 1060, 1061, 1062, 1065, 1304):  # table/col/key/trigger already exists
                skipped += 1
            else:
                print(f"[AVISO] {e.msg}")
                skipped += 1

    cursor.close()
    conn.close()

    print(f"[OK] Setup concluído — {success} statements executados, {skipped} ignorados (já existiam).")
    print("[OK] Banco 'bibliotheca_wishlist' pronto.")


def _split_sql(sql: str) -> list[str]:
    """
    Divide o SQL em statements individuais,
    lidando com DELIMITER $$ para triggers.
    """
    statements = []
    current    = []
    delimiter  = ";"
    in_dollar  = False

    for line in sql.splitlines():
        stripped = line.strip().upper()

        if stripped.startswith("DELIMITER"):
            parts = line.split()
            if len(parts) >= 2:
                delimiter = parts[1].strip()
                in_dollar = delimiter != ";"
            continue

        current.append(line)
        full = "\n".join(current)

        if in_dollar:
            if full.rstrip().endswith(delimiter):
                # Remove o delimitador do final
                clean = full.rstrip()[: -len(delimiter)].strip()
                if clean:
                    statements.append(clean)
                current = []
        else:
            if full.rstrip().endswith(";"):
                statements.append(full.rstrip().rstrip(";"))
                current = []

    return statements


if __name__ == "__main__":
    run()
