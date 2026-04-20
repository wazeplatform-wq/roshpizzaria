import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Pencil, CookingPot } from "lucide-react";

type Borda = {
  id: string;
  company_id: string;
  nome: string;
  descricao: string | null;
  ativo: boolean;
  ordem: number;
};

type Tamanho = {
  id: string;
  nome: string;
  ordem: number;
};

type BordaPreco = {
  id: string;
  borda_id: string;
  tamanho_id: string;
  preco: number;
};

const EMPTY_FORM = {
  nome: "",
  descricao: "",
  ativo: true,
  ordem: "0",
};

export function PizzaBordasManager() {
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [bordas, setBordas] = useState<Borda[]>([]);
  const [tamanhos, setTamanhos] = useState<Tamanho[]>([]);
  const [precos, setPrecos] = useState<BordaPreco[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Borda | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [precosForm, setPrecosForm] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: cid } = await supabase.rpc("get_my_company_id");
      setCompanyId(cid);
      if (!cid) return;

      const [{ data: bordasData }, { data: tamanhosData }, { data: precosData }] = await Promise.all([
        supabase.from("pizza_bordas" as any).select("*").eq("company_id", cid).order("ordem"),
        supabase.from("pizza_tamanhos" as any).select("id, nome, ordem").eq("company_id", cid).eq("ativo", true).order("ordem"),
        supabase.from("pizza_borda_precos" as any).select("*"),
      ]);

      setBordas((bordasData || []) as unknown as Borda[]);
      setTamanhos((tamanhosData || []) as unknown as Tamanho[]);
      setPrecos((precosData || []) as unknown as BordaPreco[]);
    } catch (e) {
      console.error(e);
      toast.error("Erro ao carregar bordas");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM, ordem: String(bordas.length + 1) });
    const initial: Record<string, string> = {};
    tamanhos.forEach((t) => { initial[t.id] = "0"; });
    setPrecosForm(initial);
    setOpen(true);
  };

  const openEdit = (b: Borda) => {
    setEditing(b);
    setForm({
      nome: b.nome,
      descricao: b.descricao || "",
      ativo: b.ativo,
      ordem: String(b.ordem),
    });
    const initial: Record<string, string> = {};
    tamanhos.forEach((t) => {
      const p = precos.find((x) => x.borda_id === b.id && x.tamanho_id === t.id);
      initial[t.id] = p ? String(p.preco) : "0";
    });
    setPrecosForm(initial);
    setOpen(true);
  };

  const save = async () => {
    if (!companyId) return;
    if (!form.nome.trim()) { toast.error("Informe o nome da borda"); return; }
    setSaving(true);
    try {
      const payload = {
        company_id: companyId,
        nome: form.nome.trim(),
        descricao: form.descricao.trim() || null,
        ativo: form.ativo,
        ordem: Number(form.ordem) || 0,
      };

      let bordaId = editing?.id;
      if (editing) {
        const { error } = await supabase.from("pizza_bordas" as any).update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("pizza_bordas" as any).insert(payload).select("id").single();
        if (error) throw error;
        bordaId = (data as any)?.id;
      }

      if (bordaId) {
        const upserts = tamanhos.map((t) => ({
          borda_id: bordaId,
          tamanho_id: t.id,
          preco: Number(precosForm[t.id] || 0),
        }));
        const { error } = await supabase.from("pizza_borda_precos" as any).upsert(upserts, { onConflict: "borda_id,tamanho_id" });
        if (error) throw error;
      }

      toast.success(editing ? "Borda atualizada" : "Borda criada");
      setOpen(false);
      await load();
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir esta borda?")) return;
    const { error } = await supabase.from("pizza_bordas" as any).delete().eq("id", id);
    if (error) { toast.error("Erro ao excluir"); return; }
    toast.success("Borda excluída");
    await load();
  };

  if (loading) {
    return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <CardTitle className="flex items-center gap-2"><CookingPot className="h-5 w-5" /> Bordas das Pizzas</CardTitle>
              <CardDescription>
                Cadastre as bordas (Catupiry, Cheddar, Chocolate...) com preço diferente para cada tamanho de pizza.
              </CardDescription>
            </div>
            <Button onClick={openCreate} disabled={tamanhos.length === 0}>
              <Plus className="h-4 w-4 mr-2" /> Nova borda
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {tamanhos.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              Cadastre primeiro os tamanhos das pizzas na aba "Tamanhos de Pizza".
            </div>
          ) : bordas.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              Nenhuma borda cadastrada. Clique em "Nova borda" para começar.
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {bordas.map((b) => {
                const bordaPrecos = precos.filter((p) => p.borda_id === b.id);
                return (
                  <Card key={b.id} className={b.ativo ? "" : "opacity-60"}>
                    <CardContent className="pt-4 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-bold">{b.nome}</div>
                          {b.descricao && <div className="text-xs text-muted-foreground">{b.descricao}</div>}
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <Button size="icon" variant="ghost" onClick={() => openEdit(b)}><Pencil className="h-4 w-4" /></Button>
                          <Button size="icon" variant="ghost" onClick={() => remove(b.id)}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5 text-xs">
                        {tamanhos.map((t) => {
                          const p = bordaPrecos.find((x) => x.tamanho_id === t.id);
                          return (
                            <div key={t.id} className="rounded bg-muted px-2 py-1 flex justify-between">
                              <span className="text-muted-foreground">{t.nome}</span>
                              <span className="font-semibold">R$ {Number(p?.preco || 0).toFixed(2)}</span>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar borda" : "Nova borda"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome da borda</Label>
              <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Ex: Catupiry" />
            </div>
            <div className="space-y-2">
              <Label>Descrição (opcional)</Label>
              <Input value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} placeholder="Borda recheada com catupiry cremoso" />
            </div>
            <div className="space-y-2">
              <Label>Preço por tamanho</Label>
              <div className="grid gap-2">
                {tamanhos.map((t) => (
                  <div key={t.id} className="flex items-center gap-3">
                    <span className="w-28 text-sm">{t.nome}</span>
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={precosForm[t.id] || ""}
                        onChange={(e) => setPrecosForm({ ...precosForm, [t.id]: e.target.value })}
                        placeholder="0,00"
                        className="pl-9"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Ordem</Label>
                <Input type="number" value={form.ordem} onChange={(e) => setForm({ ...form, ordem: e.target.value })} />
              </div>
              <div className="flex items-center justify-between border rounded-md p-3">
                <span className="text-sm">Ativa</span>
                <Switch checked={form.ativo} onCheckedChange={(v) => setForm({ ...form, ativo: v })} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              💡 O valor da borda é somado ao preço da pizza. Deixe 0,00 nos tamanhos em que esta borda não estiver disponível.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={save} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Salvar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
