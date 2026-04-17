
CREATE TABLE IF NOT EXISTS public.produto_grupos_opcoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  produto_id UUID NOT NULL REFERENCES public.produtos_servicos(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  tipo_grupo TEXT NOT NULL DEFAULT 'opcional',
  obrigatorio BOOLEAN NOT NULL DEFAULT false,
  minimo_escolhas INTEGER NOT NULL DEFAULT 0,
  maximo_escolhas INTEGER NOT NULL DEFAULT 1,
  ordem INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.produto_opcoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  grupo_id UUID NOT NULL REFERENCES public.produto_grupos_opcoes(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  descricao TEXT,
  preco_adicional NUMERIC(10,2) NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT true,
  ordem INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.produto_grupos_opcoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.produto_opcoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ver grupos da empresa" ON public.produto_grupos_opcoes FOR SELECT
  USING (company_id IN (SELECT company_id FROM public.user_roles WHERE user_id = auth.uid()));
CREATE POLICY "Criar grupos da empresa" ON public.produto_grupos_opcoes FOR INSERT
  WITH CHECK (company_id IN (SELECT company_id FROM public.user_roles WHERE user_id = auth.uid()));
CREATE POLICY "Atualizar grupos da empresa" ON public.produto_grupos_opcoes FOR UPDATE
  USING (company_id IN (SELECT company_id FROM public.user_roles WHERE user_id = auth.uid()));
CREATE POLICY "Excluir grupos da empresa" ON public.produto_grupos_opcoes FOR DELETE
  USING (company_id IN (SELECT company_id FROM public.user_roles WHERE user_id = auth.uid()));

CREATE POLICY "Ver opcoes da empresa" ON public.produto_opcoes FOR SELECT
  USING (company_id IN (SELECT company_id FROM public.user_roles WHERE user_id = auth.uid()));
CREATE POLICY "Criar opcoes da empresa" ON public.produto_opcoes FOR INSERT
  WITH CHECK (company_id IN (SELECT company_id FROM public.user_roles WHERE user_id = auth.uid()));
CREATE POLICY "Atualizar opcoes da empresa" ON public.produto_opcoes FOR UPDATE
  USING (company_id IN (SELECT company_id FROM public.user_roles WHERE user_id = auth.uid()));
CREATE POLICY "Excluir opcoes da empresa" ON public.produto_opcoes FOR DELETE
  USING (company_id IN (SELECT company_id FROM public.user_roles WHERE user_id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_produto_grupos_company ON public.produto_grupos_opcoes(company_id);
CREATE INDEX IF NOT EXISTS idx_produto_grupos_produto ON public.produto_grupos_opcoes(produto_id);
CREATE INDEX IF NOT EXISTS idx_produto_opcoes_company ON public.produto_opcoes(company_id);
CREATE INDEX IF NOT EXISTS idx_produto_opcoes_grupo ON public.produto_opcoes(grupo_id);
