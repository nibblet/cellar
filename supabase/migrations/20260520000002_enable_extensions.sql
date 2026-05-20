-- Phase 1 prerequisites: vector similarity (for CLIP image embeddings) and trigram
-- fuzzy matching (for matching AI-extracted product names against the catalog).

create extension if not exists vector;
create extension if not exists pg_trgm;
