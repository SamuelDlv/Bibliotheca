# ℬ Bibliotheca

Um sistema pessoal de leitura filosófica: biblioteca, anotações, citações, diário de leitura, vocabulário, mapa de autores/influências e muito mais — tudo rodando localmente, sem depender de serviços externos.

O projeto é um **frontend estático** (HTML/CSS/JS puro, sem build step) que conversa com um **backend Flask + MySQL**. Inclui também um módulo separado de **Wishlist** para acompanhar livros que você pretende comprar (com histórico de preços).

> Projeto pessoal, pensado para rodar em `localhost`. Não possui tela de login — veja a seção [Segurança](#-segurança) antes de expor em qualquer lugar além da sua própria máquina.

---

## ✨ Funcionalidades

- **Dashboard** — visão geral da coleção, progresso de leitura, heatmap de conclusões e revisões pendentes
- **Biblioteca** — cadastro de livros com status (futuro / lendo / concluído), categorias e progresso de páginas
- **Anotações** — fichas de leitura por livro (citação, síntese, impacto, perguntas, prática)
- **Mural de Citações** — citações marcantes, com ou sem livro associado, organizadas por tags
- **Diário de Leitura** — registro de sessões de leitura (páginas, duração, humor)
- **Vocabulário** — glossário de termos e conceitos filosóficos, com busca full-text
- **Autores** — perfis de autores com escola de pensamento, origem e rede de influências
- **Listas Temáticas** — coleções de livros por tema
- **Perguntas Abertas** — perguntas registradas durante a leitura, com resolução posterior
- **Busca global** — busca simultânea em livros, anotações e vocabulário
- **Wishlist** (módulo à parte) — lista de desejos de compra com histórico de preços por loja

---

## 📁 Estrutura do projeto

```
Bibliotheca/
├── frontend/                → Interface principal (HTML/CSS/JS puro)
│   ├── index.html
│   ├── app.js
│   └── style.css
├── backend/                 → API Flask do sistema principal (porta 5000)
│   ├── app.py
│   ├── setup_db.py
│   └── requirements.txt
├── database/
│   └── schema.sql           → Schema MySQL do banco principal
├── config/
│   └── .env.example         → Modelo de variáveis de ambiente do backend principal
├── wishlist/                → Módulo de lista de desejos (frontend + backend próprios)
│   ├── index.html
│   ├── wishlist.js
│   ├── wishlist.css
│   └── backend/              → API Flask da wishlist (porta 5001) — ver wishlist/README.md
├── Iniciar Bibliotheca.bat   → Atalho para subir os dois backends e abrir o frontend (Windows)
└── .gitignore
```

---

## 🚀 Instalação e uso

### 1. Pré-requisitos
- Python 3.10+
- MySQL 8.0+ (ou MariaDB 10.6+)
- Um navegador (o frontend é aberto direto como arquivo local, sem servidor web)

### 2. Configurar o backend principal
```bash
cd backend
pip install -r requirements.txt

# copie o modelo de variáveis de ambiente e preencha com sua senha do MySQL
cp ../config/.env.example .env

# cria o banco, o usuário da aplicação e o schema
python setup_db.py
```

### 3. Configurar o módulo Wishlist
Veja as instruções específicas em [`wishlist/README.md`](wishlist/README.md).

### 4. Subir tudo
```bash
# backend principal (porta 5000)
cd backend && python app.py

# backend da wishlist (porta 5001), em outro terminal
cd wishlist/backend && python app.py
```
Depois abra `frontend/index.html` no navegador.

No Windows, o atalho **`Iniciar Bibliotheca.bat`** faz os três passos acima automaticamente (instala dependências, sobe os dois backends e abre o frontend), desde que os arquivos `.env` já estejam configurados.

Em produção, prefira rodar com um servidor WSGI:
```bash
gunicorn -w 4 -b 0.0.0.0:5000 app:app
```

---

## 🔌 Variáveis de ambiente (backend principal)

Copie `config/.env.example` para `backend/.env` e edite:

| Variável       | Padrão             | Descrição            |
|----------------|---------------------|-----------------------|
| `DB_HOST`      | `localhost`          | Host do MySQL         |
| `DB_PORT`      | `3306`                | Porta do MySQL        |
| `DB_USER`      | `bibliotheca`         | Usuário da aplicação  |
| `DB_PASSWORD`  | *(defina a sua)*     | Senha da aplicação    |
| `DB_NAME`      | `bibliotheca`         | Nome do banco         |
| `FLASK_PORT`   | `5000`                | Porta da API           |
| `FLASK_DEBUG`  | `false`                | Modo debug             |

---

## 📊 Modelo de dados (backend principal)

```
categories ──────────────────────────────────────────────────
    ↑                                                          │
books ──────────── book_tags ──── global_tags                  │
  │                                                              │
  ├── notes                                                      │
  ├── quotes ──── quote_tags                                     │
  ├── diary_entries                                               │
  ├── open_questions                                               │
  └── list_books ──── theme_lists                                  │

authors ─── author_influences (auto-relacionamento)                 │
        └── author_concepts                                          │

vocabulary ──── vocab_related                                          │

activity_feed   notifications   user_settings
```

**Destaques técnicos:**
- Coluna gerada `progress_pct` em `books`, calculada automaticamente pelo MySQL
- Índices `FULLTEXT` em `books`, `notes`, `quotes` e `vocabulary` para busca rápida
- Views `v_book_summary`, `v_dashboard_stats`, `v_monthly_completions`
- Pool de conexões no Flask (10 conexões reutilizadas)
- Transações automáticas via context manager

---

## 🔗 Endpoints da API principal

| Área | Rotas |
|---|---|
| **Health** | `GET /health` |
| **Configurações** | `GET /settings` · `PATCH /settings` |
| **Livros** | `GET /books` (filtros: `status`, `category`, `q`, `sort`) · `GET /books/<id>` · `POST /books` · `PUT /books/<id>` · `DELETE /books/<id>` |
| **Categorias** | `GET /categories` · `POST /categories` · `PATCH /categories/<id>` · `DELETE /categories/<id>` |
| **Autores** | `GET /authors` · `POST /authors` · `PUT /authors/<id>` · `DELETE /authors/<id>` |
| **Anotações** | `GET /notes?book_id=` · `POST /notes` · `PUT /notes/<id>` · `DELETE /notes/<id>` |
| **Citações** | `GET /quotes?book_id=&tag=` · `POST /quotes` · `PUT /quotes/<id>` · `DELETE /quotes/<id>` |
| **Diário** | `GET /diary` · `POST /diary` · `DELETE /diary/<id>` |
| **Vocabulário** | `GET /vocabulary?q=` · `POST /vocabulary` · `PUT /vocabulary/<id>` · `DELETE /vocabulary/<id>` |
| **Listas temáticas** | `GET /lists` · `POST /lists` · `PUT /lists/<id>` · `DELETE /lists/<id>` |
| **Perguntas abertas** | `GET /questions` · `POST /questions` · `PATCH /questions/<id>/resolve` · `DELETE /questions/<id>` |
| **Tags globais** | `GET /tags` · `POST /tags` · `PATCH /tags/<tag>` · `DELETE /tags/<tag>` |
| **Dashboard** | `GET /dashboard` — stats, livros em leitura, heatmap, revisões, atividade, categorias |
| **Busca global** | `GET /search?q=` — busca em livros, anotações e vocabulário |
| **Atividade** | `GET /activity?limit=30` |
| **Notificações** | `GET /notifications` · `POST /notifications` · `PATCH /notifications/read-all` · `DELETE /notifications` |

Todas as respostas seguem o formato `{ "ok": true/false, "data": ... }` (ou `"error"` em caso de falha).

---

## 🛠️ Integração frontend ↔ backend

O frontend fala com a API através de um objeto simples de fetch (`frontend/app.js`):

```javascript
const API_BASE = "http://localhost:5000";

const API = {
  async get(path) {
    const res = await fetch(API_BASE + path);
    return (await res.json()).data;
  },
  async post(path, body) {
    const res = await fetch(API_BASE + path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return (await res.json()).data;
  },
  // ... put, patch, delete seguem o mesmo padrão
};

// Exemplo de uso:
const books = await API.get("/books?status=lendo");
await API.post("/books", { title: "A República", author: "Platão", category: "filosofia" });
```

---

## 🔒 Segurança

- Os arquivos `.env` **nunca** devem ser commitados — apenas os `.env.example` (sem senha) vão para o repositório. O `.gitignore` já cuida disso.
- Antes de rodar o projeto pela primeira vez, copie os `.env.example` correspondentes e preencha com sua própria senha do MySQL (veja [Variáveis de ambiente](#-variáveis-de-ambiente-backend-principal) e o [README da wishlist](wishlist/README.md)).
- Este backend foi feito para uso em `localhost`: o CORS está liberado (`origins="*"`) e **não há autenticação**. Não exponha os servidores (`:5000` e `:5001`) diretamente na internet sem antes adicionar autenticação e restringir o CORS à origem real do seu frontend.
