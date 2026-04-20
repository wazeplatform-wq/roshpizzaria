-- Tabela de bordas
CREATE TABLE public.pizza_bordas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  descricao TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  ordem INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pizza_bordas_company ON public.pizza_bordas(company_id);

ALTER TABLE public.pizza_bordas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view active bordas"
  ON public.pizza_bordas FOR SELECT
  USING (true);

CREATE POLICY "Company users can insert bordas"
  ON public.pizza_bordas FOR INSERT
  WITH CHECK (public.user_belongs_to_company(auth.uid(), company_id));

CREATE POLICY "Company users can update bordas"
  ON public.pizza_bordas FOR UPDATE
  USING (public.user_belongs_to_company(auth.uid(), company_id));

CREATE POLICY "Company users can delete bordas"
  ON public.pizza_bordas FOR DELETE
  USING (public.user_belongs_to_company(auth.uid(), company_id));

CREATE TRIGGER trg_pizza_bordas_updated_at
  BEFORE UPDATE ON public.pizza_bordas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Tabela de preços por tamanho
CREATE TABLE public.pizza_borda_precos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  borda_id UUID NOT NULL REFERENCES public.pizza_bordas(id) ON DELETE CASCADE,
  tamanho_id UUID NOT NULL REFERENCES public.pizza_tamanhos(id) ON DELETE CASCADE,
  preco NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (borda_id, tamanho_id)
);

CREATE INDEX idx_pizza_borda_precos_borda ON public.pizza_borda_precos(borda_id);
CREATE INDEX idx_pizza_borda_precos_tamanho ON public.pizza_borda_precos(tamanho_id);

ALTER TABLE public.pizza_borda_precos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view borda precos"
  ON public.pizza_borda_precos FOR SELECT
  USING (true);

CREATE POLICY "Company users can insert borda precos"
  ON public.pizza_borda_precos FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.pizza_bordas b
      WHERE b.id = borda_id
        AND public.user_belongs_to_company(auth.uid(), b.company_id)
    )
  );

CREATE POLICY "Company users can update borda precos"
  ON public.pizza_borda_precos FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.pizza_bordas b
      WHERE b.id = borda_id
        AND public.user_belongs_to_company(auth.uid(), b.company_id)
    )
  );

CREATE POLICY "Company users can delete borda precos"
  ON public.pizza_borda_precos FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.pizza_bordas b
      WHERE b.id = borda_id
        AND public.user_belongs_to_company(auth.uid(), b.company_id)
    )
  );

CREATE TRIGGER trg_pizza_borda_precos_updated_at
  BEFORE UPDATE ON public.pizza_borda_precos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();