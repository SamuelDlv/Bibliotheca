-- ============================================================
-- BIBLIOTHECA — Wishlist Schema (MySQL)
-- Banco independente do principal: bibliotheca_wishlist
-- ============================================================

CREATE DATABASE IF NOT EXISTS bibliotheca_wishlist
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE bibliotheca_wishlist;

-- ============================================================
-- CATEGORIAS DA WISHLIST
-- Independente das categorias do site principal.
-- Permite organizar a lista de desejos com critérios próprios.
-- ============================================================
CREATE TABLE IF NOT EXISTS wl_categories (
  id         VARCHAR(32)  NOT NULL PRIMARY KEY,
  name       VARCHAR(128) NOT NULL,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_wl_cat_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Categorias exclusivas da wishlist';

-- Dados iniciais — mesmas do principal mas editáveis de forma independente
INSERT IGNORE INTO wl_categories (id, name) VALUES
  ('filosofia',   'Filosofia'),
  ('historia',    'História'),
  ('mitologia',   'Mitologia'),
  ('estoicismo',  'Estoicismo'),
  ('politica',    'Política'),
  ('literatura',  'Literatura'),
  ('ciencia',     'Ciência'),
  ('outro',       'Outro');

-- ============================================================
-- LOJAS / FONTES DE COMPRA
-- Evita repetição e permite histórico de onde você compra.
-- ============================================================
CREATE TABLE IF NOT EXISTS wl_stores (
  id         SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name       VARCHAR(128)      NOT NULL,
  url_base   VARCHAR(512),               -- ex: https://www.amazon.com.br
  created_at DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_wl_store_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Lojas/fontes de compra reutilizáveis';

INSERT IGNORE INTO wl_stores (name, url_base) VALUES
  ('Amazon',          'https://www.amazon.com.br'),
  ('Estante Virtual', 'https://www.estantevirtual.com.br'),
  ('Livraria Cultura', 'https://www.livrariacultura.com.br'),
  ('Submarino',       'https://www.submarino.com.br'),
  ('Mercado Livre',   'https://www.mercadolivre.com.br');

-- ============================================================
-- ITENS DA WISHLIST
-- Tabela principal — cada livro desejado.
-- ============================================================
CREATE TABLE IF NOT EXISTS wl_items (
  id          VARCHAR(32)       NOT NULL PRIMARY KEY,

  -- Identificação do livro
  title       VARCHAR(512)      NOT NULL,
  author      VARCHAR(256),
  category_id VARCHAR(32),                -- FK → wl_categories (nullable: categoria livre)
  isbn        VARCHAR(20),                -- ISBN-10 ou ISBN-13 (útil para busca futura)

  -- Aquisição
  price_est   DECIMAL(10,2) UNSIGNED,     -- preço estimado em R$
  price_paid  DECIMAL(10,2) UNSIGNED,     -- preço real pago (preenchido ao comprar)
  store_id    SMALLINT UNSIGNED,          -- FK → wl_stores
  store_custom VARCHAR(128),              -- loja avulsa, sem FK
  buy_link    VARCHAR(2048),              -- URL de compra

  -- Status e prioridade
  priority    ENUM('alta','media','baixa') NOT NULL DEFAULT 'media',
  status      ENUM('desejo','comprado')    NOT NULL DEFAULT 'desejo',

  -- Notas livres
  notes       TEXT,

  -- Auditoria
  added_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  bought_at   DATETIME,                   -- preenchido automaticamente ao status='comprado'

  -- Coluna gerada: economia detectada (só se tiver preço estimado e pago)
  savings     DECIMAL(10,2) AS (
    IF(price_est IS NOT NULL AND price_paid IS NOT NULL AND price_est > price_paid,
       ROUND(price_est - price_paid, 2),
       NULL)
  ) STORED COMMENT 'Economia obtida vs estimativa',

  CONSTRAINT fk_wli_category FOREIGN KEY (category_id) REFERENCES wl_categories(id) ON DELETE SET NULL,
  CONSTRAINT fk_wli_store    FOREIGN KEY (store_id)    REFERENCES wl_stores(id)      ON DELETE SET NULL,

  INDEX idx_wli_status    (status),
  INDEX idx_wli_priority  (priority),
  INDEX idx_wli_category  (category_id),
  INDEX idx_wli_added     (added_at DESC),
  INDEX idx_wli_bought    (bought_at DESC),
  -- Full-text para busca por título/autor/notas
  FULLTEXT idx_ft_wli (title, author, notes)

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Itens da wishlist de livros';

-- ============================================================
-- HISTÓRICO DE PREÇOS
-- Registra cada vez que o preço de um item é atualizado.
-- Permite visualizar se o preço baixou desde que você adicionou.
-- ============================================================
CREATE TABLE IF NOT EXISTS wl_price_history (
  id         INT UNSIGNED  NOT NULL AUTO_INCREMENT PRIMARY KEY,
  item_id    VARCHAR(32)   NOT NULL,
  price      DECIMAL(10,2) UNSIGNED NOT NULL,
  store_id   SMALLINT UNSIGNED,
  recorded_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_ph_item  FOREIGN KEY (item_id)  REFERENCES wl_items(id)  ON DELETE CASCADE,
  CONSTRAINT fk_ph_store FOREIGN KEY (store_id) REFERENCES wl_stores(id) ON DELETE SET NULL,
  INDEX idx_ph_item (item_id, recorded_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Histórico de preços por item — detecta variações';

-- ============================================================
-- TRIGGER: registrar preço automaticamente ao inserir/atualizar
-- ============================================================
DELIMITER $$

-- Ao inserir um item com preço, salva no histórico
CREATE TRIGGER trg_wli_insert_price
AFTER INSERT ON wl_items
FOR EACH ROW
BEGIN
  IF NEW.price_est IS NOT NULL THEN
    INSERT INTO wl_price_history (item_id, price, store_id)
    VALUES (NEW.id, NEW.price_est, NEW.store_id);
  END IF;
END$$

-- Ao atualizar preço estimado, salva nova entrada no histórico
CREATE TRIGGER trg_wli_update_price
AFTER UPDATE ON wl_items
FOR EACH ROW
BEGIN
  IF (OLD.price_est IS NULL AND NEW.price_est IS NOT NULL)
  OR (OLD.price_est IS NOT NULL AND NEW.price_est IS NOT NULL AND OLD.price_est <> NEW.price_est)
  THEN
    INSERT INTO wl_price_history (item_id, price, store_id)
    VALUES (NEW.id, NEW.price_est, NEW.store_id);
  END IF;

  -- Ao marcar como comprado, registrar timestamp automaticamente
  IF OLD.status <> 'comprado' AND NEW.status = 'comprado' THEN
    UPDATE wl_items SET bought_at = NOW() WHERE id = NEW.id;
  END IF;
END$$

DELIMITER ;

-- ============================================================
-- VIEWS
-- ============================================================

-- Vista completa de cada item com nomes resolvidos
CREATE OR REPLACE VIEW v_wl_items AS
SELECT
  i.id,
  i.title,
  i.author,
  i.category_id,
  c.name            AS category_name,
  i.isbn,
  i.price_est,
  i.price_paid,
  i.savings,
  i.store_id,
  COALESCE(s.name, i.store_custom) AS store_name,
  s.url_base        AS store_url_base,
  i.buy_link,
  i.priority,
  i.status,
  i.notes,
  i.added_at,
  i.updated_at,
  i.bought_at,

  -- Preço mínimo já registrado no histórico (detecta se vale comprar agora)
  (SELECT MIN(ph.price)
   FROM wl_price_history ph WHERE ph.item_id = i.id) AS price_min_ever,

  -- Preço mais recente no histórico
  (SELECT ph.price FROM wl_price_history ph
   WHERE ph.item_id = i.id ORDER BY ph.recorded_at DESC LIMIT 1) AS price_latest

FROM wl_items i
LEFT JOIN wl_categories c ON c.id = i.category_id
LEFT JOIN wl_stores      s ON s.id = i.store_id;


-- Estatísticas gerais da wishlist
CREATE OR REPLACE VIEW v_wl_stats AS
SELECT
  COUNT(*)                                          AS total_items,
  SUM(status = 'desejo')                            AS pending_count,
  SUM(status = 'comprado')                          AS bought_count,
  SUM(priority = 'alta' AND status = 'desejo')      AS high_priority_count,
  ROUND(SUM(CASE WHEN status='desejo'   THEN price_est  ELSE 0 END), 2) AS estimated_total,
  ROUND(SUM(CASE WHEN status='comprado' THEN price_paid ELSE 0 END), 2) AS spent_total,
  ROUND(SUM(COALESCE(savings, 0)), 2)               AS total_savings
FROM wl_items;


-- Itens agrupados por categoria
CREATE OR REPLACE VIEW v_wl_by_category AS
SELECT
  c.id    AS category_id,
  c.name  AS category_name,
  COUNT(i.id)                     AS total,
  SUM(i.status = 'desejo')        AS pending,
  SUM(i.status = 'comprado')      AS bought,
  ROUND(SUM(i.price_est), 2)      AS estimated_value
FROM wl_categories c
LEFT JOIN wl_items i ON i.category_id = c.id
GROUP BY c.id, c.name
ORDER BY total DESC;
