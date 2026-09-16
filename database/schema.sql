-- ============================================================
-- BIBLIOTHECA v3 — MySQL Schema Otimizado
-- ============================================================

CREATE DATABASE IF NOT EXISTS bibliotheca
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE bibliotheca;

-- ============================================================
-- CATEGORIAS
-- ============================================================
CREATE TABLE IF NOT EXISTS categories (
  id          VARCHAR(64)  NOT NULL PRIMARY KEY,
  name        VARCHAR(128) NOT NULL,
  color       VARCHAR(16)  NOT NULL DEFAULT '#7a8090',
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_category_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- AUTORES
-- ============================================================
CREATE TABLE IF NOT EXISTS authors (
  id          VARCHAR(32)  NOT NULL PRIMARY KEY,
  name        VARCHAR(256) NOT NULL,
  life        VARCHAR(128),          -- ex: "121–180 d.C."
  school      VARCHAR(128),          -- ex: "Estoicismo"
  origin      VARCHAR(128),          -- ex: "Romano"
  bio         TEXT,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_author_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Relação de influências entre autores (many-to-many)
CREATE TABLE IF NOT EXISTS author_influences (
  influencer_id  VARCHAR(32) NOT NULL,  -- quem influenciou
  influenced_id  VARCHAR(32) NOT NULL,  -- quem foi influenciado
  PRIMARY KEY (influencer_id, influenced_id),
  CONSTRAINT fk_ai_influencer FOREIGN KEY (influencer_id) REFERENCES authors(id) ON DELETE CASCADE,
  CONSTRAINT fk_ai_influenced FOREIGN KEY (influenced_id) REFERENCES authors(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Conceitos-chave por autor
CREATE TABLE IF NOT EXISTS author_concepts (
  author_id   VARCHAR(32)  NOT NULL,
  concept     VARCHAR(128) NOT NULL,
  PRIMARY KEY (author_id, concept),
  CONSTRAINT fk_ac_author FOREIGN KEY (author_id) REFERENCES authors(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- LIVROS
-- ============================================================
CREATE TABLE IF NOT EXISTS books (
  id           VARCHAR(32)  NOT NULL PRIMARY KEY,
  title        VARCHAR(512) NOT NULL,
  author       VARCHAR(256) NOT NULL,
  category_id  VARCHAR(64)  NOT NULL,
  status       ENUM('lendo','concluido','futuro') NOT NULL DEFAULT 'futuro',
  total_pages  SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  pages_read   SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  year         YEAR,
  quick_notes  TEXT,
  before_read  TEXT,          -- reflexão antes de ler
  review_days  SMALLINT UNSIGNED,  -- dias para revisão após conclusão
  era          VARCHAR(128),       -- ex: "Séc. IV a.C."
  completed_at DATETIME,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  -- Progresso calculado (coluna gerada, evita cálculo no app)
  progress_pct TINYINT UNSIGNED AS (
    IF(total_pages = 0, 0, LEAST(100, ROUND((pages_read / total_pages) * 100)))
  ) STORED,

  CONSTRAINT fk_book_category FOREIGN KEY (category_id) REFERENCES categories(id),
  INDEX idx_book_status    (status),
  INDEX idx_book_category  (category_id),
  INDEX idx_book_author    (author),
  INDEX idx_book_year      (year),
  -- Índice para busca full-text
  FULLTEXT idx_ft_book (title, author, quick_notes)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tags dos livros (many-to-many com tags globais)
CREATE TABLE IF NOT EXISTS book_tags (
  book_id   VARCHAR(32)  NOT NULL,
  tag       VARCHAR(128) NOT NULL,
  PRIMARY KEY (book_id, tag),
  CONSTRAINT fk_bt_book FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
  INDEX idx_bt_tag (tag)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- TAGS GLOBAIS
-- ============================================================
CREATE TABLE IF NOT EXISTS global_tags (
  tag        VARCHAR(128) NOT NULL PRIMARY KEY,
  color      VARCHAR(16)  NOT NULL DEFAULT '#7a8090',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- ANOTAÇÕES
-- ============================================================
CREATE TABLE IF NOT EXISTS notes (
  id          VARCHAR(32) NOT NULL PRIMARY KEY,
  book_id     VARCHAR(32) NOT NULL,
  quote       TEXT,               -- trecho/citação do livro
  synthesis   TEXT,               -- síntese pessoal
  impact      TEXT,               -- impacto pessoal
  questions   TEXT,               -- perguntas geradas
  practice    TEXT,               -- aplicação prática
  after_read  TEXT,               -- reflexão após leitura
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_note_book FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
  INDEX idx_note_book (book_id),
  FULLTEXT idx_ft_note (quote, synthesis, impact, questions, practice)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- CITAÇÕES (MURAL)
-- ============================================================
CREATE TABLE IF NOT EXISTS quotes (
  id          VARCHAR(32)  NOT NULL PRIMARY KEY,
  text        TEXT         NOT NULL,
  book_id     VARCHAR(32),           -- pode ser avulsa (sem livro)
  reflection  TEXT,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_quote_book FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE SET NULL,
  INDEX idx_quote_book (book_id),
  FULLTEXT idx_ft_quote (text, reflection)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tags das citações
CREATE TABLE IF NOT EXISTS quote_tags (
  quote_id  VARCHAR(32)  NOT NULL,
  tag       VARCHAR(128) NOT NULL,
  PRIMARY KEY (quote_id, tag),
  CONSTRAINT fk_qt_quote FOREIGN KEY (quote_id) REFERENCES quotes(id) ON DELETE CASCADE,
  INDEX idx_qt_tag (tag)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- DIÁRIO DE LEITURA
-- ============================================================
CREATE TABLE IF NOT EXISTS diary_entries (
  id          VARCHAR(32) NOT NULL PRIMARY KEY,
  book_id     VARCHAR(32),
  entry_date  DATE        NOT NULL,
  pages_read  SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  duration    SMALLINT UNSIGNED NOT NULL DEFAULT 0,  -- minutos
  mood        ENUM('focado','contemplativo','inquieto','cansado','inspirado','confuso') NOT NULL DEFAULT 'focado',
  note        TEXT,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_diary_book FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE SET NULL,
  INDEX idx_diary_book (book_id),
  INDEX idx_diary_date (entry_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- VOCABULÁRIO / CONCEITOS
-- ============================================================
CREATE TABLE IF NOT EXISTS vocabulary (
  id          VARCHAR(32)  NOT NULL PRIMARY KEY,
  term        VARCHAR(256) NOT NULL,
  origin      VARCHAR(256),          -- etimologia
  definition  TEXT         NOT NULL,
  source      VARCHAR(512),          -- onde encontrou
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uq_vocab_term (term),
  INDEX idx_vocab_term (term),
  FULLTEXT idx_ft_vocab (term, definition, origin)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Conceitos relacionados (auto-referencial via tabela pivot)
CREATE TABLE IF NOT EXISTS vocab_related (
  vocab_id    VARCHAR(32)  NOT NULL,
  related_term VARCHAR(128) NOT NULL,
  PRIMARY KEY (vocab_id, related_term),
  CONSTRAINT fk_vr_vocab FOREIGN KEY (vocab_id) REFERENCES vocabulary(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- LISTAS TEMÁTICAS
-- ============================================================
CREATE TABLE IF NOT EXISTS theme_lists (
  id          VARCHAR(32)  NOT NULL PRIMARY KEY,
  name        VARCHAR(256) NOT NULL,
  description TEXT,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Livros em cada lista
CREATE TABLE IF NOT EXISTS list_books (
  list_id   VARCHAR(32) NOT NULL,
  book_id   VARCHAR(32) NOT NULL,
  added_at  DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (list_id, book_id),
  CONSTRAINT fk_lb_list FOREIGN KEY (list_id) REFERENCES theme_lists(id) ON DELETE CASCADE,
  CONSTRAINT fk_lb_book FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- PERGUNTAS ABERTAS
-- ============================================================
CREATE TABLE IF NOT EXISTS open_questions (
  id          VARCHAR(32) NOT NULL PRIMARY KEY,
  text        TEXT        NOT NULL,
  book_id     VARCHAR(32),
  resolved    BOOLEAN     NOT NULL DEFAULT FALSE,
  answer      TEXT,
  resolved_at DATETIME,
  created_at  DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_oq_book FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE SET NULL,
  INDEX idx_oq_resolved (resolved),
  INDEX idx_oq_book     (book_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- ATIVIDADE (FEED)
-- ============================================================
CREATE TABLE IF NOT EXISTS activity_feed (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  icon       VARCHAR(8)   NOT NULL,
  text       VARCHAR(512) NOT NULL,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_activity_time (created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- NOTIFICAÇÕES
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
  id          VARCHAR(32)  NOT NULL PRIMARY KEY,
  icon        VARCHAR(8)   NOT NULL,
  title       VARCHAR(256) NOT NULL,
  message     TEXT         NOT NULL,
  book_id     VARCHAR(32),
  is_read     BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_notif_book FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE SET NULL,
  INDEX idx_notif_read (is_read),
  INDEX idx_notif_time (created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- CONFIGURAÇÕES DO USUÁRIO
-- ============================================================
CREATE TABLE IF NOT EXISTS user_settings (
  setting_key   VARCHAR(64)  NOT NULL PRIMARY KEY,
  setting_value VARCHAR(512) NOT NULL,
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Valores padrão
INSERT IGNORE INTO user_settings (setting_key, setting_value) VALUES
  ('goal',  '12'),
  ('speed', '30');

-- ============================================================
-- DADOS INICIAIS — Categorias padrão
-- ============================================================
INSERT IGNORE INTO categories (id, name, color) VALUES
  ('filosofia',  'Filosofia',   '#5a7ab8'),
  ('historia',   'História',    '#6a90a8'),
  ('mitologia',  'Mitologia',   '#8070b0'),
  ('estoicismo', 'Estoicismo',  '#5a9870'),
  ('politica',   'Política',    '#a06060'),
  ('biologia',   'Biologia',    '#5a9080'),
  ('outro',      'Outro',       '#7a8090');

-- ============================================================
-- VIEWS ÚTEIS
-- ============================================================

-- Resumo de cada livro com contagens
CREATE OR REPLACE VIEW v_book_summary AS
SELECT
  b.id,
  b.title,
  b.author,
  b.category_id,
  c.name       AS category_name,
  c.color      AS category_color,
  b.status,
  b.total_pages,
  b.pages_read,
  b.progress_pct,
  b.year,
  b.era,
  b.quick_notes,
  b.before_read,
  b.review_days,
  b.completed_at,
  b.created_at,
  COUNT(DISTINCT n.id)  AS notes_count,
  COUNT(DISTINCT q.id)  AS quotes_count,
  GROUP_CONCAT(DISTINCT bt.tag ORDER BY bt.tag SEPARATOR ',') AS tags
FROM books b
LEFT JOIN categories c      ON c.id      = b.category_id
LEFT JOIN notes n           ON n.book_id = b.id
LEFT JOIN quotes q          ON q.book_id = b.id
LEFT JOIN book_tags bt      ON bt.book_id = b.id
GROUP BY b.id;

-- Estatísticas gerais do painel
CREATE OR REPLACE VIEW v_dashboard_stats AS
SELECT
  COUNT(*)                                                   AS total_books,
  SUM(status = 'lendo')                                      AS reading_count,
  SUM(status = 'concluido')                                  AS done_count,
  SUM(status = 'futuro')                                     AS queue_count,
  (SELECT COUNT(*) FROM notes)                               AS notes_count,
  (SELECT COUNT(*) FROM quotes)                              AS quotes_count,
  (SELECT COUNT(*) FROM vocabulary)                          AS vocab_count,
  (SELECT COUNT(*) FROM diary_entries)                       AS diary_count,
  (SELECT COALESCE(SUM(duration),0) FROM diary_entries)      AS total_reading_minutes,
  (SELECT COALESCE(SUM(pages_read),0) FROM diary_entries)    AS total_pages_read_diary
FROM books;

-- Progresso mensal (heatmap)
CREATE OR REPLACE VIEW v_monthly_completions AS
SELECT
  YEAR(completed_at)  AS year,
  MONTH(completed_at) AS month,
  COUNT(*)            AS books_completed
FROM books
WHERE status = 'concluido' AND completed_at IS NOT NULL
GROUP BY YEAR(completed_at), MONTH(completed_at);

-- ============================================================
-- MIGRAÇÃO v3.1 — Adicionar cor a global_tags (para bases existentes)
-- Execute apenas se atualizar de uma versão anterior
-- ============================================================
-- ALTER TABLE global_tags ADD COLUMN IF NOT EXISTS color VARCHAR(16) NOT NULL DEFAULT '#7a8090';
