#!/usr/bin/env python3
"""
BIBLIOTHECA — Script de Setup do Banco de Dados
Cria o banco, usuário e executa o schema SQL.

Uso:
  python setup_db.py
  python setup_db.py --host localhost --user root --password sua_senha
"""

import argparse
import getpass
import sys
import os

try:
    import mysql.connector
except ImportError:
    print("Instale as dependências primeiro: pip install -r requirements.txt")
    sys.exit(1)


def run_setup(host, port, root_user, root_pass, db_name, db_user, db_pass):
    print(f"\n{'='*60}")
    print("  BIBLIOTHECA — Setup do Banco de Dados")
    print(f"{'='*60}\n")

    # 1. Conectar como root
    print(f"[1/4] Conectando ao MySQL em {host}:{port}...")
    try:
        conn = mysql.connector.connect(
            host=host, port=port, user=root_user, password=root_pass
        )
        cursor = conn.cursor()
        print("      ✓ Conexão estabelecida\n")
    except mysql.connector.Error as e:
        print(f"      ✗ Erro de conexão: {e}")
        sys.exit(1)

    # 2. Criar banco e usuário
    print(f"[2/4] Criando banco '{db_name}' e usuário '{db_user}'...")
    try:
        cursor.execute(f"CREATE DATABASE IF NOT EXISTS `{db_name}` "
                       "CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci")
        cursor.execute(
            f"CREATE USER IF NOT EXISTS '{db_user}'@'%' IDENTIFIED BY '{db_pass}'"
        )
        cursor.execute(
            f"GRANT ALL PRIVILEGES ON `{db_name}`.* TO '{db_user}'@'%'"
        )
        cursor.execute("FLUSH PRIVILEGES")
        conn.commit()
        print("      ✓ Banco e usuário configurados\n")
    except mysql.connector.Error as e:
        print(f"      ✗ Erro: {e}")
        sys.exit(1)

    # 3. Executar schema.sql
    schema_path = os.path.join(os.path.dirname(__file__), "schema.sql")
    print(f"[3/4] Executando schema de {schema_path}...")
    try:
        with open(schema_path, "r", encoding="utf-8") as f:
            sql = f.read()

        cursor.execute(f"USE `{db_name}`")
        # Executar statements um por um
        statements = [s.strip() for s in sql.split(";") if s.strip() and not s.strip().startswith("--")]
        for stmt in statements:
            if stmt.upper().startswith(("CREATE DATABASE", "USE")):
                continue  # Já foi feito acima
            try:
                cursor.execute(stmt)
                conn.commit()
            except mysql.connector.Error as e:
                if e.errno == 1050:  # Table already exists
                    pass
                elif e.errno == 1060:  # Duplicate column
                    pass
                else:
                    print(f"      Aviso em statement: {e}")

        print("      ✓ Schema criado com sucesso\n")

        # Migração: adicionar coluna color a global_tags se não existir
        try:
            cursor.execute(f"USE `{db_name}`")
            cursor.execute("ALTER TABLE global_tags ADD COLUMN color VARCHAR(16) NOT NULL DEFAULT '#7a8090'")
            conn.commit()
            print("      ✓ Migração: coluna color adicionada a global_tags\n")
        except mysql.connector.Error as e:
            if e.errno == 1060:  # Duplicate column — já existe
                pass
            else:
                print(f"      Aviso migração: {e}")

    except FileNotFoundError:
        print(f"      ✗ Arquivo schema.sql não encontrado em {schema_path}")
        sys.exit(1)
    except mysql.connector.Error as e:
        print(f"      ✗ Erro ao executar schema: {e}")
        sys.exit(1)

    cursor.close()
    conn.close()

    # 4. Criar .env
    print("[4/4] Criando arquivo .env...")
    env_content = f"""# Gerado automaticamente pelo setup_db.py
DB_HOST={host}
DB_PORT={port}
DB_USER={db_user}
DB_PASSWORD={db_pass}
DB_NAME={db_name}

FLASK_HOST=0.0.0.0
FLASK_PORT=5000
FLASK_DEBUG=false
"""
    env_path = os.path.join(os.path.dirname(__file__), ".env")
    with open(env_path, "w") as f:
        f.write(env_content)
    print("      ✓ .env criado\n")

    print(f"{'='*60}")
    print("  ✅ Setup concluído com sucesso!")
    print(f"{'='*60}\n")
    print("  Para iniciar o servidor:")
    print("    python app.py")
    print("  Ou em produção:")
    print("    gunicorn -w 4 -b 0.0.0.0:5000 app:app\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Setup do banco Bibliotheca")
    parser.add_argument("--host",     default="localhost",        help="Host MySQL")
    parser.add_argument("--port",     default=3306,    type=int,  help="Porta MySQL")
    parser.add_argument("--user",     default="root",             help="Usuário root MySQL")
    parser.add_argument("--password", default=None,               help="Senha root MySQL")
    parser.add_argument("--db-name",  default="bibliotheca",      help="Nome do banco")
    parser.add_argument("--db-user",  default="bibliotheca",      help="Usuário da aplicação")
    parser.add_argument("--db-pass",  default="bibliotheca_pass", help="Senha da aplicação")
    args = parser.parse_args()

    root_pass = args.password
    if root_pass is None:
        root_pass = getpass.getpass(f"Senha do usuário '{args.user}' no MySQL: ")

    run_setup(
        host=args.host,
        port=args.port,
        root_user=args.user,
        root_pass=root_pass,
        db_name=args.db_name,
        db_user=args.db_user,
        db_pass=args.db_pass,
    )
