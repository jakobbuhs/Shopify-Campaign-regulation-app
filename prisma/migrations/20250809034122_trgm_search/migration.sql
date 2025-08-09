-- This is an empty migration.
-- Enable trigram extension (safe to run repeatedly)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Trigram indexes for fast fuzzy/substring search
CREATE INDEX IF NOT EXISTS idx_variant_title_trgm
  ON "Variant" USING GIN ("title" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_product_title_trgm
  ON "Product" USING GIN ("title" gin_trgm_ops);
