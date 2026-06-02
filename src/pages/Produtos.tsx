import React, { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { Package, ImagePlus, Trash2, Edit2 } from 'lucide-react';
import { PizzaTamanhosManager } from '@/components/produtos/PizzaTamanhosManager';
import { PizzaBordasManager } from '@/components/produtos/PizzaBordasManager';

type TipoProduto = 'produto' | 'insumo' | 'combo' | 'adicional';

type Produto = {
  id: number;
  nome: string;
  categoria: string;
  subcategoria: string | null;
  descricao: string | null;
  preco_sugerido: number;
  tipo_produto: TipoProduto;
  ativo: boolean;
  ativo_cardapio: boolean;
  imagem_url: string | null;
  destaque_cardapio: boolean;
  permite_observacao: boolean;
  estoque_atual: number | null;
  estoque_minimo: number | null;
  unidade_medida: string | null;
  grupos: number;
};

type ProdutoForm = {
  nome: string;
  categoria: string;
  subcategoria: string;
  descricao: string;
  preco_sugerido: string;
  tipo_produto: TipoProduto;
  ativo: boolean;
  ativo_cardapio: boolean;
  destaque_cardapio: boolean;
  permite_observacao: boolean;
  estoque_atual: string;
  estoque_minimo: string;
  unidade_medida: string;
  grupos: string;
};

type Opcao = {
  id: number;
  nome: string;
  preco_adicional: number;
  ativo: boolean;
};

const PRODUCT_TABS = [
  { key: 'todos', label: 'Todos' },
  { key: 'produto', label: 'Produtos' },
  { key: 'combo', label: 'Combos' },
  { key: 'adicional', label: 'Adicionais' },
  { key: 'insumo', label: 'Insumos' },
  { key: 'opcoes', label: 'Opções' },
  { key: 'tamanhos', label: 'Tamanhos' },
  { key: 'bordas', label: 'Bordas' },
];

const CSS = `
:root{--bg:#0f0f11;--surface:#17171a;--surface2:#1e1e22;--surface3:#252529;--border:rgba(255,255,255,0.08);--border-hover:rgba(255,255,255,0.16);--text:#f0f0f0;--text2:#9999aa;--text3:#666677;--accent:#ff6b35;--accent2:#ff9a1e;--accent-dim:rgba(255,107,53,0.12);--radius:14px;--radius-sm:10px;--mono: 'JetBrains Mono', monospace}
*{box-sizing:border-box;margin:0;padding:0}
html,body,#root{min-height:100%}
body{background:var(--bg);color:var(--text);font-family:Inter,system-ui,Arial,Helvetica,sans-serif}
.page{padding:28px;max-width:1240px;margin:0 auto}
.page-header{display:flex;justify-content:space-between;align-items:flex-start;gap:14px;margin-bottom:24px}
.page-title{font-size:26px;font-weight:700}
.page-sub{color:var(--text2);font-size:14px;margin-top:6px;max-width:680px}
.header-actions{display:flex;gap:10px;flex-wrap:wrap}
.kpi-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:14px;margin-bottom:20px}
.kpi-card{background:var(--surface);border:1px solid var(--border);padding:16px;border-radius:18px;min-height:94px}
.kpi-label{font-size:12px;color:var(--text2);text-transform:uppercase;letter-spacing:.08em;margin-bottom:6px}
.kpi-value{font-size:28px;font-weight:700}
.tabs{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px}
.tab-trigger{padding:10px 16px;border-radius:999px;border:1px solid var(--border);background:var(--surface);color:var(--text2);cursor:pointer}
.tab-trigger[data-state='active']{background:var(--accent);color:#fff;border-color:transparent}
.filter-bar{display:flex;gap:12px;flex-wrap:wrap;align-items:center;margin-bottom:18px}
.search-input{width:320px;min-width:220px;max-width:100%;padding:10px 14px;border-radius:12px;border:1px solid var(--border);background:var(--surface);color:var(--text)}
.product-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:16px}
.prod-card{position:relative;background:var(--surface);border:1px solid var(--border);border-radius:18px;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 16px 30px rgba(0,0,0,0.12)}
.prod-card.destaque{border-color:var(--accent);box-shadow:0 18px 40px rgba(255,107,53,0.18)}
.prod-image-wrap{position:relative;height:160px;background:linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02));display:flex;align-items:center;justify-content:center}
.image-placeholder{width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:var(--text2);font-size:42px;}
.badge{position:absolute;top:14px;left:14px;padding:6px 12px;border-radius:999px;font-size:12px;font-weight:700;background:rgba(0,0,0,0.45);color:#fff}
.prod-body{padding:18px;display:flex;flex-direction:column;gap:10px}
.prod-name{font-size:18px;font-weight:700}
.prod-category{font-size:12px;color:var(--text3);font-family:var(--mono);letter-spacing:.02em}
.prod-desc{color:var(--text2);font-size:13px;line-height:1.5}
.prod-meta{display:flex;justify-content:space-between;align-items:center;padding:16px;border-top:1px solid rgba(255,255,255,0.06);background:var(--surface2)}
.prod-meta span{font-size:13px;color:var(--text2)}
.toggle{width:36px;height:20px;background:var(--surface3);border-radius:999px;cursor:pointer}
.toggle.on{background:var(--accent)}
.prod-actions{display:flex;gap:10px;padding:16px;border-top:1px solid rgba(255,255,255,0.06);background:var(--surface2)}
.action-btn{flex:1;min-width:0;padding:10px 14px;border-radius:12px;border:1px solid var(--border);background:transparent;color:var(--text);cursor:pointer}
.action-btn.danger{border-color:rgba(255,107,53,0.22);color:var(--accent)}
.modal-backdrop{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.55);z-index:200}
.modal-shell{background:var(--surface);border:1px solid var(--border);border-radius:18px;width:min(760px,95%);max-height:90vh;overflow:auto}
.modal-header{padding:18px 22px;border-bottom:1px solid rgba(255,255,255,0.06);display:flex;justify-content:space-between;align-items:center}
.modal-title{font-size:18px;font-weight:700}
.modal-body{padding:20px;display:grid;gap:16px}
.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.form-grid-full{grid-column:span 2}
.form-input,
.form-textarea{width:100%;padding:12px 14px;border-radius:14px;border:1px solid var(--border);background:var(--surface2);color:var(--text)}
.form-textarea{min-height:110px;resize:vertical}
.image-upload-box{border:1px dashed rgba(255,255,255,0.16);border-radius:16px;padding:18px;display:flex;align-items:center;justify-content:space-between;gap:14px;background:rgba(255,255,255,0.03)}
.image-upload-label{font-size:14px;color:var(--text2)}
.empty-state{padding:40px 22px;border-radius:18px;background:var(--surface2);border:1px dashed rgba(255,255,255,0.08);color:var(--text2);text-align:center}
`; 

const mockProducts: Produto[] = [
  { id: 1, nome: 'Pizza Calabresa', categoria: 'Pizzas Tradicionais', subcategoria: 'Salgadas', descricao: 'Molho, mussarela e calabresa', preco_sugerido: 49.9, tipo_produto: 'produto', ativo: true, ativo_cardapio: true, imagem_url: null, destaque_cardapio: true, permite_observacao: true, estoque_atual: 12, estoque_minimo: 2, unidade_medida: 'un', grupos: 2 },
  { id: 2, nome: 'Pizza 4 Queijos', categoria: 'Pizzas Especiais', subcategoria: 'Salgadas', descricao: 'Mussarela, parmesão, catupiry e gorgonzola', preco_sugerido: 62.9, tipo_produto: 'produto', ativo: true, ativo_cardapio: true, imagem_url: null, destaque_cardapio: true, permite_observacao: true, estoque_atual: 8, estoque_minimo: 1, unidade_medida: 'un', grupos: 2 },
  { id: 5, nome: 'Combo Família', categoria: 'Combos', subcategoria: null, descricao: '2 pizzas grandes + 2 refrigerantes 2L', preco_sugerido: 119.9, tipo_produto: 'combo', ativo: true, ativo_cardapio: true, imagem_url: null, destaque_cardapio: true, permite_observacao: true, estoque_atual: null, estoque_minimo: null, unidade_medida: null, grupos: 0 },
  { id: 8, nome: 'Farinha de Trigo 5kg', categoria: 'Insumos', subcategoria: null, descricao: 'Farinha tipo 1', preco_sugerido: 0, tipo_produto: 'insumo', ativo: true, ativo_cardapio: false, imagem_url: null, destaque_cardapio: false, permite_observacao: false, estoque_atual: 34, estoque_minimo: 5, unidade_medida: 'kg', grupos: 0 },
];

const mockOptions: Opcao[] = [
  { id: 1, nome: 'Borda recheada', preco_adicional: 7.5, ativo: true },
  { id: 2, nome: 'Extra catupiry', preco_adicional: 5.0, ativo: true },
];

const EMPTY_FORM: ProdutoForm = {
  nome: '',
  categoria: '',
  subcategoria: '',
  descricao: '',
  preco_sugerido: '0',
  tipo_produto: 'produto',
  ativo: true,
  ativo_cardapio: true,
  destaque_cardapio: false,
  permite_observacao: true,
  estoque_atual: '',
  estoque_minimo: '',
  unidade_medida: '',
  grupos: '0',
};

export default function Produtos() {
  const [produtos, setProdutos] = useState<Produto[]>(mockProducts);
  const [tipoTab, setTipoTab] = useState<string>('todos');
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Produto | null>(null);
  const [formData, setFormData] = useState<ProdutoForm>({ ...EMPTY_FORM });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Produto | null>(null);
  const [opcoes, setOpcoes] = useState<Opcao[]>(mockOptions);
  const [optionDialogOpen, setOptionDialogOpen] = useState(false);
  const [editingOption, setEditingOption] = useState<Opcao | null>(null);
  const [optionForm, setOptionForm] = useState({ nome: '', preco_adicional: '0', ativo: true });

  const filteredProdutos = useMemo(() => {
    const q = deferredSearch.trim().toLowerCase();
    const specialTabs = ['opcoes', 'tamanhos', 'bordas'];
    if (specialTabs.includes(tipoTab)) return [];
    return produtos.filter((p) => {
      const byType = tipoTab === 'todos' ? true : p.tipo_produto === tipoTab;
      const bySearch = !q || p.nome.toLowerCase().includes(q) || p.categoria.toLowerCase().includes(q) || (p.subcategoria || '').toLowerCase().includes(q);
      return byType && bySearch;
    });
  }, [produtos, deferredSearch, tipoTab]);

  useEffect(() => {
    if (!imageFile) {
      setImagePreview(editing?.imagem_url ?? '');
    }
  }, [editing, imageFile]);

  useEffect(() => {
    return () => {
      if (imagePreview.startsWith('blob:')) {
        URL.revokeObjectURL(imagePreview);
      }
    };
  }, [imagePreview]);

  const handleOpenCreate = useCallback((tipo: TipoProduto) => {
    setEditing(null);
    setFormData({ ...EMPTY_FORM, tipo_produto: tipo });
    setImageFile(null);
    setImagePreview('');
    setDialogOpen(true);
  }, []);

  const handleOpenEdit = useCallback((produto: Produto) => {
    setEditing(produto);
    setFormData({
      nome: produto.nome,
      categoria: produto.categoria,
      subcategoria: produto.subcategoria ?? '',
      descricao: produto.descricao ?? '',
      preco_sugerido: produto.preco_sugerido.toString(),
      tipo_produto: produto.tipo_produto,
      ativo: produto.ativo,
      ativo_cardapio: produto.ativo_cardapio,
      destaque_cardapio: produto.destaque_cardapio,
      permite_observacao: produto.permite_observacao,
      estoque_atual: produto.estoque_atual?.toString() ?? '',
      estoque_minimo: produto.estoque_minimo?.toString() ?? '',
      unidade_medida: produto.unidade_medida ?? '',
      grupos: produto.grupos.toString(),
    });
    setImageFile(null);
    setImagePreview(produto.imagem_url ?? '');
    setDialogOpen(true);
  }, []);

  const handleOpenOptionCreate = useCallback(() => {
    setEditingOption(null);
    setOptionForm({ nome: '', preco_adicional: '0', ativo: true });
    setOptionDialogOpen(true);
  }, []);

  const handleOpenEditOption = useCallback((option: Opcao) => {
    setEditingOption(option);
    setOptionForm({ nome: option.nome, preco_adicional: option.preco_adicional.toString(), ativo: option.ativo });
    setOptionDialogOpen(true);
  }, []);

  const handleSaveOption = useCallback(() => {
    if (!optionForm.nome.trim()) {
      toast.error('Nome da opção é obrigatório');
      return;
    }
    const preco = Number(optionForm.preco_adicional);
    if (Number.isNaN(preco) || preco < 0) {
      toast.error('Preço da opção deve ser zero ou maior');
      return;
    }
    const option: Opcao = {
      id: editingOption?.id ?? Date.now(),
      nome: optionForm.nome.trim(),
      preco_adicional: preco,
      ativo: optionForm.ativo,
    };
    setOpcoes((prev) => {
      if (editingOption) {
        return prev.map((opt) => (opt.id === editingOption.id ? option : opt));
      }
      return [option, ...prev];
    });
    setOptionDialogOpen(false);
    setEditingOption(null);
    toast.success('Opção salva com sucesso');
  }, [editingOption, optionForm]);

  const handleDeleteOption = useCallback((optionId: number) => {
    setOpcoes((prev) => prev.filter((opt) => opt.id !== optionId));
    toast.success('Opção removida');
  }, []);

  const revokePreview = useCallback(() => {
    if (imagePreview.startsWith('blob:')) {
      URL.revokeObjectURL(imagePreview);
    }
  }, [imagePreview]);

  const handleImageChange = useCallback((file: File | null) => {
    revokePreview();
    setImageFile(file);
    if (file) {
      setImagePreview(URL.createObjectURL(file));
    } else {
      setImagePreview(editing?.imagem_url ?? '');
    }
  }, [editing, revokePreview]);

  const fileToDataUrl = useCallback((file: File) => {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }, []);

  const uploadProductImage = useCallback(async (): Promise<string | null> => {
    if (!imageFile) {
      return editing?.imagem_url ?? null;
    }
    return await fileToDataUrl(imageFile);
  }, [editing, fileToDataUrl, imageFile]);

  const handleSave = useCallback(async () => {
    if (!formData.nome.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }
    const preco = Number(formData.preco_sugerido);
    if (Number.isNaN(preco) || preco < 0) {
      toast.error('Preço não pode ser negativo');
      return;
    }

    const imagem_url = await uploadProductImage();
    const produto: Produto = {
      id: editing?.id ?? Date.now(),
      nome: formData.nome.trim(),
      categoria: formData.categoria.trim(),
      subcategoria: formData.subcategoria.trim() || null,
      descricao: formData.descricao.trim() || null,
      preco_sugerido: preco,
      tipo_produto: formData.tipo_produto,
      ativo: formData.ativo,
      ativo_cardapio: formData.ativo_cardapio,
      imagem_url,
      destaque_cardapio: formData.destaque_cardapio,
      permite_observacao: formData.permite_observacao,
      estoque_atual: formData.estoque_atual.trim() ? Number(formData.estoque_atual) : null,
      estoque_minimo: formData.estoque_minimo.trim() ? Number(formData.estoque_minimo) : null,
      unidade_medida: formData.unidade_medida.trim() || null,
      grupos: Number(formData.grupos) || 0,
    };

    setProdutos((prev) => {
      if (editing) {
        return prev.map((p) => (p.id === editing.id ? produto : p));
      }
      return [produto, ...prev];
    });
    setDialogOpen(false);
    setEditing(null);
    setImageFile(null);
    setImagePreview('');
    toast.success('Produto salvo com sucesso');
  }, [editing, formData, uploadProductImage]);

  const confirmDelete = useCallback(() => {
    if (!deleteTarget) return;
    setProdutos((prev) => prev.filter((p) => p.id !== deleteTarget.id));
    setDeleteTarget(null);
    toast.success('Produto excluído');
  }, [deleteTarget]);

  const onChangeForm = useCallback((key: keyof ProdutoForm, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  }, []);

  return (
    <div className="page">
      <style>{CSS}</style>

      <div className="page-header">
        <div>
          <div className="page-title">Produtos</div>
          <div className="page-sub">Cadastre pizzas, bebidas, combos, adicionais e insumos com visual moderno e controles fechados.</div>
        </div>
        <div className="header-actions">
          <Button variant="secondary" onClick={() => handleOpenCreate('insumo')}>🍳 Novo Insumo</Button>
          <Button onClick={() => handleOpenCreate('produto')}>＋ Novo Produto</Button>
        </div>
      </div>

      <div className="kpi-grid">
        <div className="kpi-card"><div className="kpi-label">Total de itens</div><div className="kpi-value">{produtos.length}</div></div>
        <div className="kpi-card"><div className="kpi-label">No cardápio</div><div className="kpi-value">{produtos.filter((p) => p.ativo_cardapio).length}</div></div>
        <div className="kpi-card"><div className="kpi-label">Insumos</div><div className="kpi-value">{produtos.filter((p) => p.tipo_produto === 'insumo').length}</div></div>
        <div className="kpi-card"><div className="kpi-label">Com opções</div><div className="kpi-value">{produtos.filter((p) => p.grupos > 0).length}</div></div>
      </div>

      <Tabs value={tipoTab} onValueChange={setTipoTab}>
        <TabsList className="tabs">
          {PRODUCT_TABS.map((tab) => (
            <TabsTrigger key={tab.key} value={tab.key} className="tab-trigger">{tab.label}</TabsTrigger>
          ))}
        </TabsList>

        <div className="filter-bar">
          <Input placeholder="Buscar por nome, categoria..." value={search} onChange={(event) => setSearch(event.target.value)} className="search-input" />
          <Button variant="outline" onClick={() => setSearch('')}>Limpar</Button>
        </div>

        <TabsContent value="todos">
          {filteredProdutos.length ? (
            <div className="product-grid">
              {filteredProdutos.map((produto) => (
                <div className={`prod-card ${produto.destaque_cardapio ? 'destaque' : ''}`} key={produto.id}>
                  <div className="prod-image-wrap">
                    {produto.imagem_url ? (
                      <img src={produto.imagem_url} alt={produto.nome} style={{ objectFit: 'cover', width: '100%', height: '100%' }} />
                    ) : (
                      <div className="image-placeholder"><Package size={42} /></div>
                    )}
                    <span className="badge">{produto.tipo_produto}</span>
                  </div>
                  <div className="prod-body">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div className="prod-name">{produto.nome}</div>
                      {produto.destaque_cardapio && <span className="badge" style={{ top: 14, right: 14, left: 'auto', background: 'var(--accent)', position: 'absolute' }}>DESTAQUE</span>}
                    </div>
                    <div className="prod-category">{[produto.categoria, produto.subcategoria].filter(Boolean).join(' / ')}</div>
                    {produto.descricao && <div className="prod-desc">{produto.descricao}</div>}
                  </div>
                  <div className="prod-meta">
                    <div>
                      <div style={{ fontWeight: 700, color: 'var(--accent)' }}>{produto.preco_sugerido > 0 ? produto.preco_sugerido.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'Sem preço'}</div>
                      <span>{produto.estoque_atual != null ? `Estoque: ${produto.estoque_atual}${produto.unidade_medida ? ` ${produto.unidade_medida}` : ''}` : 'Sem estoque'}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span style={{ fontSize: 12, color: 'var(--text3)' }}>Ativo</span>
                        <div className={`toggle ${produto.ativo ? 'on' : ''}`} onClick={() => setProdutos((prev) => prev.map((p) => p.id === produto.id ? { ...p, ativo: !p.ativo } : p))} />
                      </div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span style={{ fontSize: 12, color: 'var(--text3)' }}>Cardápio</span>
                        <div className={`toggle ${produto.ativo_cardapio ? 'on' : ''}`} onClick={() => setProdutos((prev) => prev.map((p) => p.id === produto.id ? { ...p, ativo_cardapio: !p.ativo_cardapio } : p))} />
                      </div>
                    </div>
                  </div>
                  <div className="prod-actions">
                    <button className="action-btn" type="button" onClick={() => handleOpenEdit(produto)}><Edit2 size={16} /> Editar</button>
                    <button className="action-btn" type="button" onClick={() => setDeleteTarget(produto)}><Trash2 size={16} /> Excluir</button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">Nenhum produto encontrado para esta seleção.</div>
          )}
        </TabsContent>

        {PRODUCT_TABS.filter((tab) => !['todos', 'opcoes', 'tamanhos', 'bordas'].includes(tab.key)).map((tab) => (
          <TabsContent key={tab.key} value={tab.key}>
            {filteredProdutos.length ? (
              <div className="product-grid">
                {filteredProdutos.map((produto) => (
                  <div className="prod-card" key={produto.id}>
                    <div className="prod-image-wrap">
                      {produto.imagem_url ? (
                        <img src={produto.imagem_url} alt={produto.nome} style={{ objectFit: 'cover', width: '100%', height: '100%' }} />
                      ) : (
                        <div className="image-placeholder"><Package size={42} /></div>
                      )}
                      <span className="badge">{produto.tipo_produto}</span>
                    </div>
                    <div className="prod-body">
                      <div className="prod-name">{produto.nome}</div>
                      <div className="prod-category">{[produto.categoria, produto.subcategoria].filter(Boolean).join(' / ')}</div>
                      {produto.descricao && <div className="prod-desc">{produto.descricao}</div>}
                    </div>
                    <div className="prod-meta">
                      <div>
                        <div style={{ fontWeight: 700, color: 'var(--accent)' }}>{produto.preco_sugerido > 0 ? produto.preco_sugerido.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'Sem preço'}</div>
                        <span>{produto.estoque_atual != null ? `Estoque: ${produto.estoque_atual}${produto.unidade_medida ? ` ${produto.unidade_medida}` : ''}` : 'Sem estoque'}</span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <span style={{ fontSize: 12, color: 'var(--text3)' }}>Ativo</span>
                          <div className={`toggle ${produto.ativo ? 'on' : ''}`} onClick={() => setProdutos((prev) => prev.map((p) => p.id === produto.id ? { ...p, ativo: !p.ativo } : p))} />
                        </div>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <span style={{ fontSize: 12, color: 'var(--text3)' }}>Cardápio</span>
                          <div className={`toggle ${produto.ativo_cardapio ? 'on' : ''}`} onClick={() => setProdutos((prev) => prev.map((p) => p.id === produto.id ? { ...p, ativo_cardapio: !p.ativo_cardapio } : p))} />
                        </div>
                      </div>
                    </div>
                    <div className="prod-actions">
                      <button className="action-btn" type="button" onClick={() => handleOpenEdit(produto)}><Edit2 size={16} /> Editar</button>
                      <button className="action-btn" type="button" onClick={() => setDeleteTarget(produto)}><Trash2 size={16} /> Excluir</button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">Nenhum produto encontrado para esta seleção.</div>
            )}
          </TabsContent>
        ))}

        <TabsContent value="opcoes">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, gap: 12, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>Opções de produto</div>
              <div style={{ color: 'var(--text2)', marginTop: 6 }}>Adicione complementos e opções que podem ser aplicados nos produtos.</div>
            </div>
            <Button onClick={handleOpenOptionCreate}>＋ Nova Opção</Button>
          </div>
          {opcoes.length ? (
            <div className="product-grid">
              {opcoes.map((opcao) => (
                <div className="prod-card" key={opcao.id} style={{ position: 'relative' }}>
                  <div className="prod-body" style={{ paddingBottom: 12 }}>
                    <div className="prod-name">{opcao.nome}</div>
                    <div className="prod-category">{`+ ${opcao.preco_adicional.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`}</div>
                  </div>
                  <div className="prod-actions">
                    <button className="action-btn" type="button" onClick={() => handleOpenEditOption(opcao)}><Edit2 size={16} /> Editar</button>
                    <button className="action-btn danger" type="button" onClick={() => handleDeleteOption(opcao.id)}><Trash2 size={16} /> Excluir</button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">Nenhuma opção cadastrada ainda.</div>
          )}
        </TabsContent>
        <TabsContent value="tamanhos">
          <PizzaTamanhosManager />
        </TabsContent>
        <TabsContent value="bordas">
          <PizzaBordasManager />
        </TabsContent>
      </Tabs>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>Excluir "{deleteTarget?.nome}" permanentemente?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteTarget(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={confirmDelete}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {dialogOpen && (
        <div className="modal-backdrop">
          <div className="modal-shell">
            <div className="modal-header">
              <div>
                <div className="modal-title">{editing ? 'Editar produto' : 'Novo produto'}</div>
              </div>
              <Button variant="ghost" onClick={() => { setDialogOpen(false); setEditing(null); setImageFile(null); setImagePreview(''); }}>Fechar</Button>
            </div>
            <div className="modal-body">
              <div className="form-grid">
                <div>
                  <Label htmlFor="nome">Nome</Label>
                  <Input id="nome" value={formData.nome} onChange={(event) => onChangeForm('nome', event.target.value)} />
                </div>
                <div>
                  <Label htmlFor="categoria">Categoria</Label>
                  <Input id="categoria" value={formData.categoria} onChange={(event) => onChangeForm('categoria', event.target.value)} />
                </div>
                <div>
                  <Label htmlFor="subcategoria">Subcategoria</Label>
                  <Input id="subcategoria" value={formData.subcategoria} onChange={(event) => onChangeForm('subcategoria', event.target.value)} />
                </div>
                <div>
                  <Label htmlFor="preco">Preço sugerido</Label>
                  <Input id="preco" type="number" step="0.01" min="0" value={formData.preco_sugerido} onChange={(event) => onChangeForm('preco_sugerido', event.target.value)} />
                </div>
                <div className="form-grid-full">
                  <Label htmlFor="descricao">Descrição</Label>
                  <Textarea id="descricao" value={formData.descricao} onChange={(event) => onChangeForm('descricao', event.target.value)} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <Label htmlFor="destaque" style={{ minWidth: 100 }}>Destaque</Label>
                  <input
                    id="destaque"
                    type="checkbox"
                    checked={formData.destaque_cardapio}
                    onChange={(event) => onChangeForm('destaque_cardapio', event.target.checked)}
                  />
                </div>
                <div className="form-grid-full">
                  <div className="image-upload-box">
                    <div>
                      <div className="image-upload-label">Imagem do produto</div>
                      <div style={{ marginTop: 8, color: 'var(--text2)' }}>Selecione um arquivo para mostrar no card.</div>
                    </div>
                    <label style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <ImagePlus size={18} />
                      <span>Selecionar</span>
                      <input type="file" accept="image/*" hidden onChange={(event) => handleImageChange(event.target.files?.[0] ?? null)} />
                    </label>
                  </div>
                  {imagePreview && (
                    <div style={{ borderRadius: 16, overflow: 'hidden', border: '1px solid var(--border)' }}>
                      <img src={imagePreview} alt="Pré-visualização" style={{ width: '100%', height: 220, objectFit: 'cover' }} />
                    </div>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <Button type="button" variant="secondary" onClick={() => { setDialogOpen(false); setEditing(null); setImageFile(null); setImagePreview(''); }}>Cancelar</Button>
                <Button type="button" onClick={handleSave}>Salvar</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {optionDialogOpen && (
        <div className="modal-backdrop">
          <div className="modal-shell">
            <div className="modal-header">
              <div>
                <div className="modal-title">{editingOption ? 'Editar opção' : 'Nova opção'}</div>
              </div>
              <Button variant="ghost" onClick={() => { setOptionDialogOpen(false); setEditingOption(null); }}>Fechar</Button>
            </div>
            <div className="modal-body">
              <div className="form-grid">
                <div className="form-grid-full">
                  <Label htmlFor="optionName">Nome da opção</Label>
                  <Input id="optionName" value={optionForm.nome} onChange={(event) => setOptionForm((prev) => ({ ...prev, nome: event.target.value }))} />
                </div>
                <div className="form-grid-full">
                  <Label htmlFor="optionPrice">Preço adicional</Label>
                  <Input id="optionPrice" type="number" step="0.01" min="0" value={optionForm.preco_adicional} onChange={(event) => setOptionForm((prev) => ({ ...prev, preco_adicional: event.target.value }))} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <Label htmlFor="optionActive" style={{ minWidth: 100 }}>Ativa</Label>
                  <input id="optionActive" type="checkbox" checked={optionForm.ativo} onChange={(event) => setOptionForm((prev) => ({ ...prev, ativo: event.target.checked }))} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <Button variant="secondary" onClick={() => { setOptionDialogOpen(false); setEditingOption(null); }}>Cancelar</Button>
                <Button onClick={handleSaveOption}>{editingOption ? 'Salvar' : 'Criar'}</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
