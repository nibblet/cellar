-- Winston's AI-generated tasting note, cached per product.
-- Shape: { text, input_hash, generated_at }
ALTER TABLE products ADD COLUMN IF NOT EXISTS winston_prose jsonb;
