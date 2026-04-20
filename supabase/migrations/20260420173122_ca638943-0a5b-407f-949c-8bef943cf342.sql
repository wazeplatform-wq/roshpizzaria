UPDATE public.produtos_servicos
SET permite_meio_a_meio = true
WHERE (
  categoria ILIKE '%pizza%'
  OR subcategoria ILIKE '%pizza%'
  OR nome ILIKE '%pizza%'
)
AND COALESCE(permite_meio_a_meio, false) = false;