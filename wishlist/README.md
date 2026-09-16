# ♡ Bibliotheca — Wishlist

Módulo independente do [Bibliotheca](../README.md) para acompanhar livros que você pretende comprar: prioridade, categoria, loja, preço estimado/pago e histórico de preços ao longo do tempo.

Roda como um frontend estático próprio (`index.html`) conectado a um backend Flask + MySQL próprio, separado do backend principal — assim você pode usar a wishlist mesmo sem ter o resto do Bibliotheca configurado.

---

## 📁 Estrutura

```
wishlist/
├── index.html        → Interface da wishlist
├── wishlist.js        → Lógica do frontend (fala com o backend via fetch)
├── wishlist.css        → Estilos
└── backend/
    ├── app.py           → API Flask (porta 5001)
    ├── schema.sql        → Schema MySQL (banco bibliotheca_wishlist)
    ├── setup_db.py        → Script de instalação do banco
    ├── requirements.txt    → Dependências Python
    └── .env.example         → Modelo de variáveis de ambiente
```

---

## 🚀 Instalação

### 1. Pré-requisitos
- Python 3.10+
- MySQL 8.0+ (ou MariaDB 10.6+)

### 2. Instalar dependências
```bash
cd wishlist/backend
pip install -r requirements.txt
```

### 3. Configurar variáveis de ambiente
```bash
cp .env.example .env
# edite o .env e preencha com sua senha do MySQL
```

### 4. Criar o banco
```bash
python setup_db.py
```
O script executa `schema.sql`, que cria o banco `bibliotheca_wishlist` (se não existir) e todas as tabelas — é idempotente, pode rodar de novo sem duplicar nada.

### 5. Iniciar o servidor
```bash
python app.py
```
A API sobe em `http://localhost:5001`. Depois é só abrir `wishlist/index.html` no navegador.

---

## 🔌 Variáveis de ambiente

| Variável          | Padrão                    | Descrição                     |
|-------------------|----------------------------|---------------------------------|
| `WL_DB_HOST`      | `localhost`                  | Host do MySQL                   |
| `WL_DB_PORT`      | `3306`                        | Porta do MySQL                  |
| `WL_DB_USER`      | `bibliotheca`                  | Usuário da aplicação            |
| `WL_DB_PASSWORD`  | *(defina a sua)*              | Senha da aplicação              |
| `WL_DB_NAME`      | `bibliotheca_wishlist`          | Nome do banco                   |
| `WL_HOST`         | `0.0.0.0`                        | Host onde a API escuta          |
| `WL_PORT`         | `5001`                            | Porta da API                     |
| `WL_DEBUG`        | `false`                            | Modo debug                       |

---

## 📊 Modelo de dados

```
wl_categories ──┐
                 ├──── wl_items ──── wl_price_history
wl_stores ──────┘                        │
                                          └── (uma entrada por registro de preço)
```

- **`wl_items`** — o item desejado: título, autor, categoria, ISBN, preço estimado/pago, loja, prioridade (`alta`/`media`/`baixa`), status (`desejo`/`comprado`)
- **`wl_price_history`** — histórico de preços registrados manualmente para um item, por loja
- **`wl_categories`** / **`wl_stores`** — criadas automaticamente conforme você cadastra itens (auto-criação por nome, sem precisar cadastrar antes)

O backend expõe views (`v_wl_items`, `v_wl_stats`, `v_wl_by_category`) que já vêm com os joins prontos (categoria, loja, menor preço já visto, etc).

---

## 🔗 Endpoints da API

| Área | Rotas |
|---|---|
| **Health** | `GET /health` |
| **Itens** | `GET /items` (filtros: `priority`, `status`, `category`, `q`, `sort`) · `GET /items/<id>` · `POST /items` · `PUT /items/<id>` · `DELETE /items/<id>` |
| **Histórico de preços** | `GET /items/<id>/price-history` · `POST /items/<id>/price-history` |
| **Categorias** | `GET /categories` · `POST /categories` · `DELETE /categories/<id>` |
| **Lojas** | `GET /stores` · `POST /stores` |
| **Estatísticas** | `GET /stats` — resumo geral, breakdown por categoria e últimos itens comprados |

Todas as respostas seguem o formato `{ "ok": true/false, "data": ... }` (ou `"error"` em caso de falha).

---

## 🔒 Segurança

Assim como o backend principal, este módulo não tem autenticação e é pensado para `localhost`. Veja a seção [Segurança](../README.md#-segurança) do README principal antes de expor a API fora da sua máquina.
