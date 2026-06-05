import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// ─── Types ───────────────────────────────────────────────────────────────────
type Mesa = {
  id: string;
  company_id: string;
  numero: string;
  nome: string | null;
  capacidade: number;
  status: string; // db status (ignored, derived from pedidos)
  localizacao: string | null;
  observacoes: string | null;
};

type PedidoStatus =
  | "novo"
  | "aceito"
  | "em_producao"
  | "pronto"
  | "saiu_entrega"
  | "entregue"
  | "cancelado";

type Pedido = {
  id: string;
  company_id: string;
  mesa_id: string | null;
  codigo_pedido: string;
  cliente_nome: string;
  status: PedidoStatus;
  status_pagamento: string;
  total: number;
  observacoes: string | null;
  created_at: string;
};

type PedidoItem = {
  id: string;
  pedido_id: string;
  produto_id: string | null;
  produto_nome: string;
  quantidade: number;
  valor_unitario: number;
  valor_total: number;
  observacoes: string | null;
};

type Produto = {
  id: string;
  nome: string;
  categoria: string | null;
  preco_sugerido: number | null;
};

type DerivedStatus = "livre" | "ocupada" | "pronto" | "alerta";

// ─── Helpers ─────────────────────────────────────────────────────────────────
const brl = (v: number) =>
  Number(v || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

const minutesSince = (iso: string) =>
  Math.floor((Date.now() - new Date(iso).getTime()) / 60000);

const fmtTempo = (m: number) =>
  m < 60 ? `${m}min` : `${Math.floor(m / 60)}h${String(m % 60).padStart(2, "0")}`;

const OPEN_STATUSES: PedidoStatus[] = [
  "novo",
  "aceito",
  "em_producao",
  "pronto",
];

function deriveMesaStatus(pedidos: Pedido[]): {
  status: DerivedStatus;
  tempo: number;
} {
  const open = pedidos.filter((p) => OPEN_STATUSES.includes(p.status));
  if (open.length === 0) return { status: "livre", tempo: 0 };
  const tempo = Math.min(...open.map((p) => minutesSince(p.created_at)));
  if (open.some((p) => p.status === "pronto"))
    return { status: "pronto", tempo };
  if (tempo > 60) return { status: "alerta", tempo };
  return { status: "ocupada", tempo };
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function MesasView({ companyId }: { companyId: string }) {
  const [mesas, setMesas] = useState<Mesa[]>([]);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [itens, setItens] = useState<PedidoItem[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<
    "todos" | "ocupada" | "pronto" | "alerta" | "livre"
  >("todos");
  const [selectedMesa, setSelectedMesa] = useState<Mesa | null>(null);
  const [showNovaMesa, setShowNovaMesa] = useState(false);
  const [showComanda, setShowComanda] = useState<Mesa | null>(null);
  const [showAddItem, setShowAddItem] = useState<Mesa | null>(null);
  const [showFechar, setShowFechar] = useState<Mesa | null>(null);

  // Load data
  const load = useCallback(async () => {
    const [mesasRes, pedidosRes, itensRes, produtosRes] = await Promise.all([
      (supabase.from("mesas" as any) as any)
        .select("*")
        .eq("company_id", companyId)
        .order("numero"),
      (supabase.from("pedidos" as any) as any)
        .select("*")
        .eq("company_id", companyId)
        .eq("tipo_atendimento", "mesa")
        .in("status", [...OPEN_STATUSES, "entregue"])
        .order("created_at", { ascending: false })
        .limit(500),
      (supabase.from("pedido_itens" as any) as any)
        .select("*")
        .eq("company_id", companyId)
        .limit(1000),
      (supabase.from("produtos_servicos" as any) as any)
        .select("id,nome,categoria,preco_sugerido")
        .eq("company_id", companyId)
        .eq("ativo", true)
        .order("nome")
        .limit(500),
    ]);

    if (!mesasRes.error) {
      const list = (mesasRes.data || []) as Mesa[];
      list.sort((a, b) => {
        const na = parseInt(a.numero, 10);
        const nb = parseInt(b.numero, 10);
        if (!isNaN(na) && !isNaN(nb)) return na - nb;
        return a.numero.localeCompare(b.numero);
      });
      setMesas(list);
    }
    if (!pedidosRes.error) setPedidos(pedidosRes.data || []);
    if (!itensRes.error) setItens(itensRes.data || []);
    if (!produtosRes.error) setProdutos(produtosRes.data || []);
    setLoading(false);
  }, [companyId]);

  useEffect(() => {
    load();
  }, [load]);

  // Realtime
  useEffect(() => {
    const ch = supabase
      .channel(`mesas-view-${companyId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "mesas", filter: `company_id=eq.${companyId}` },
        () => load()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pedidos", filter: `company_id=eq.${companyId}` },
        () => load()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pedido_itens" },
        () => load()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [companyId, load]);

  // Tick to refresh elapsed time every 30s
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 30000);
    return () => clearInterval(t);
  }, []);

  // Aggregations
  const mesaPedidos = useMemo(() => {
    const map: Record<string, Pedido[]> = {};
    for (const p of pedidos) {
      if (!p.mesa_id) continue;
      (map[p.mesa_id] ||= []).push(p);
    }
    return map;
  }, [pedidos]);

  const pedidoItens = useMemo(() => {
    const map: Record<string, PedidoItem[]> = {};
    for (const it of itens) (map[it.pedido_id] ||= []).push(it);
    return map;
  }, [itens]);

  const mesasComputed = useMemo(() => {
    return mesas.map((m) => {
      const ps = (mesaPedidos[m.id] || []).filter((p) =>
        OPEN_STATUSES.includes(p.status)
      );
      const allItems = ps.flatMap((p) => pedidoItens[p.id] || []);
      const total = allItems.reduce((s, i) => s + Number(i.valor_total || 0), 0);
      const { status, tempo } = deriveMesaStatus(mesaPedidos[m.id] || []);
      return { mesa: m, pedidos: ps, items: allItems, total, status, tempo };
    });
  }, [mesas, mesaPedidos, pedidoItens]);

  const filtered = useMemo(() => {
    if (filter === "todos") return mesasComputed;
    return mesasComputed.filter((m) => m.status === filter);
  }, [mesasComputed, filter]);

  const stats = useMemo(() => {
    const ocupadas = mesasComputed.filter((m) => m.status !== "livre").length;
    const pedidosAbertos = mesasComputed.reduce(
      (s, m) => s + m.pedidos.length,
      0
    );
    const faturamento = mesasComputed.reduce((s, m) => s + m.total, 0);
    return { ocupadas, pedidosAbertos, faturamento };
  }, [mesasComputed]);

  // Actions
  const criarMesa = async (numero: string, capacidade: number) => {
    if (!numero.trim()) return toast.error("Informe o número da mesa");
    const { error } = await (supabase.from("mesas" as any) as any).insert({
      company_id: companyId,
      numero: numero.trim(),
      capacidade,
      status: "livre",
    });
    if (error) return toast.error("Erro ao criar mesa: " + error.message);
    toast.success("Mesa criada");
    setShowNovaMesa(false);
    load();
  };

  const abrirComanda = async (mesa: Mesa, pessoas: number, nome: string) => {
    const { error } = await (supabase.from("pedidos" as any) as any).insert({
      company_id: companyId,
      mesa_id: mesa.id,
      cliente_nome: nome.trim() || `Mesa ${mesa.numero}`,
      cliente_telefone: "",
      canal: "interno",
      tipo_atendimento: "mesa",
      status: "aceito",
      total: 0,
      subtotal: 0,
      observacoes: pessoas ? `${pessoas} pessoa(s)` : null,
    });
    if (error) return toast.error("Erro: " + error.message);
    await (supabase.from("mesas" as any) as any)
      .update({ status: "ocupada" })
      .eq("id", mesa.id);
    toast.success(`Comanda aberta para Mesa ${mesa.numero}`);
    setShowComanda(null);
    load();
  };

  const adicionarItem = async (
    mesa: Mesa,
    produto: Produto,
    qtd: number,
    obs: string
  ) => {
    const open = (mesaPedidos[mesa.id] || []).find((p) =>
      OPEN_STATUSES.includes(p.status)
    );
    let pedidoId = open?.id;
    if (!pedidoId) {
      const { data, error } = await (supabase.from("pedidos" as any) as any)
        .insert({
          company_id: companyId,
          mesa_id: mesa.id,
          cliente_nome: `Mesa ${mesa.numero}`,
          cliente_telefone: "",
          canal: "interno",
          tipo_atendimento: "mesa",
          status: "aceito",
          total: 0,
          subtotal: 0,
        })
        .select("id")
        .single();
      if (error || !data) return toast.error("Erro ao abrir comanda");
      pedidoId = (data as any).id;
    }
    const preco = Number(produto.preco_sugerido || 0);
    const { error: itErr } = await (
      supabase.from("pedido_itens" as any) as any
    ).insert({
      pedido_id: pedidoId,
      company_id: companyId,
      produto_id: produto.id,
      produto_nome: produto.nome,
      quantidade: qtd,
      valor_unitario: preco,
      valor_total: preco * qtd,
      observacoes: obs || null,
    });
    if (itErr) return toast.error("Erro: " + itErr.message);

    // Update pedido totals
    const allItems = (pedidoItens[pedidoId] || []).concat([
      {
        id: "tmp",
        pedido_id: pedidoId,
        produto_id: produto.id,
        produto_nome: produto.nome,
        quantidade: qtd,
        valor_unitario: preco,
        valor_total: preco * qtd,
        observacoes: obs || null,
      } as PedidoItem,
    ]);
    const novoTotal = allItems.reduce(
      (s, i) => s + Number(i.valor_total || 0),
      0
    );
    await (supabase.from("pedidos" as any) as any)
      .update({ subtotal: novoTotal, total: novoTotal })
      .eq("id", pedidoId);
    toast.success("Item adicionado");
    load();
  };

  const fecharMesa = async (mesa: Mesa, formaPagamento: string) => {
    const open = (mesaPedidos[mesa.id] || []).filter((p) =>
      OPEN_STATUSES.includes(p.status)
    );
    if (open.length === 0) return toast.error("Nenhum pedido aberto");
    const ids = open.map((p) => p.id);
    const { error } = await (supabase.from("pedidos" as any) as any)
      .update({
        status: "entregue",
        status_pagamento: "pago",
        forma_pagamento: formaPagamento,
      })
      .in("id", ids);
    if (error) return toast.error("Erro: " + error.message);
    await (supabase.from("mesas" as any) as any)
      .update({ status: "livre" })
      .eq("id", mesa.id);
    toast.success(`Mesa ${mesa.numero} fechada`);
    setShowFechar(null);
    load();
  };

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "#6B7280" }}>
        Carregando mesas...
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
      {/* Stats + actions toolbar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 16px 12px",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", gap: 8 }}>
          {(
            [
              { k: "todos", l: "Todas" },
              { k: "ocupada", l: "🔴 Ocupadas" },
              { k: "pronto", l: "🟢 Com pedido pronto" },
              { k: "alerta", l: "⚠️ Aguardando muito" },
              { k: "livre", l: "⚪ Livres" },
            ] as const
          ).map((c) => (
            <button
              key={c.k}
              onClick={() => setFilter(c.k)}
              style={{
                padding: "6px 12px",
                borderRadius: 20,
                background:
                  filter === c.k ? "rgba(255,92,0,0.12)" : "#0f1113",
                border:
                  filter === c.k
                    ? "1px solid rgba(255,92,0,0.35)"
                    : "1px solid #1F2937",
                color: filter === c.k ? "#FF8C42" : "#9CA3AF",
                fontSize: 12,
                cursor: "pointer",
                fontWeight: 500,
              }}
            >
              {c.l}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 11, color: "#6B7280" }}>
            {mesas.length} mesas · {stats.ocupadas} ocupadas ·{" "}
            {brl(stats.faturamento)} em aberto
          </span>
          <button
            onClick={() => setShowNovaMesa(true)}
            style={{
              padding: "6px 14px",
              borderRadius: 8,
              border: "1px solid rgba(255,92,0,0.35)",
              background: "rgba(255,92,0,0.1)",
              color: "#FF8C42",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            + Nova Mesa
          </button>
        </div>
      </div>

      {/* Grid */}
      <div
        style={{
          flex: 1,
          overflow: "auto",
          padding: "0 16px 16px",
        }}
      >
        {filtered.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "60px 16px",
              color: "#6B7280",
              border: "1px dashed #1F2937",
              borderRadius: 12,
            }}
          >
            <div style={{ fontSize: 32, marginBottom: 8 }}>🪑</div>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
              Nenhuma mesa encontrada
            </div>
            <div style={{ fontSize: 12 }}>
              {mesas.length === 0
                ? "Clique em '+ Nova Mesa' para começar."
                : "Mude o filtro acima."}
            </div>
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fill, minmax(220px, 1fr))",
              gap: 12,
            }}
          >
            {filtered.map(({ mesa, items, total, status, tempo, pedidos }) => (
              <MesaCard
                key={mesa.id}
                mesa={mesa}
                items={items}
                total={total}
                status={status}
                tempo={tempo}
                pedidosCount={pedidos.length}
                onOpen={() =>
                  status === "livre" ? setShowComanda(mesa) : setSelectedMesa(mesa)
                }
                onAddItem={() => setShowAddItem(mesa)}
                onFechar={() => setShowFechar(mesa)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      {showNovaMesa && (
        <NovaMesaModal
          onClose={() => setShowNovaMesa(false)}
          onConfirm={criarMesa}
        />
      )}
      {showComanda && (
        <NovaComandaModal
          mesa={showComanda}
          onClose={() => setShowComanda(null)}
          onConfirm={(p, n) => abrirComanda(showComanda, p, n)}
        />
      )}
      {showAddItem && (
        <AddItemModal
          mesa={showAddItem}
          produtos={produtos}
          onClose={() => setShowAddItem(null)}
          onConfirm={(prod, qtd, obs) =>
            adicionarItem(showAddItem, prod, qtd, obs).then(() =>
              setShowAddItem(null)
            )
          }
        />
      )}
      {showFechar && (
        <FecharContaModal
          mesa={showFechar}
          total={
            mesasComputed.find((m) => m.mesa.id === showFechar.id)?.total || 0
          }
          onClose={() => setShowFechar(null)}
          onConfirm={(fp) => fecharMesa(showFechar, fp)}
        />
      )}
      {selectedMesa && (
        <DetalheMesaModal
          mesa={selectedMesa}
          info={mesasComputed.find((m) => m.mesa.id === selectedMesa.id)}
          pedidoItens={pedidoItens}
          onClose={() => setSelectedMesa(null)}
          onAddItem={() => {
            setShowAddItem(selectedMesa);
            setSelectedMesa(null);
          }}
          onFechar={() => {
            setShowFechar(selectedMesa);
            setSelectedMesa(null);
          }}
        />
      )}
    </div>
  );
}

// ─── MesaCard ────────────────────────────────────────────────────────────────
function MesaCard({
  mesa,
  items,
  total,
  status,
  tempo,
  pedidosCount,
  onOpen,
  onAddItem,
  onFechar,
}: {
  mesa: Mesa;
  items: PedidoItem[];
  total: number;
  status: DerivedStatus;
  tempo: number;
  pedidosCount: number;
  onOpen: () => void;
  onAddItem: () => void;
  onFechar: () => void;
}) {
  const isLivre = status === "livre";
  const stripColor =
    status === "alerta"
      ? "linear-gradient(90deg,#EF4444,#ff6b6b)"
      : status === "pronto"
      ? "linear-gradient(90deg,#2ECC8F,#5EE3B0)"
      : status === "ocupada"
      ? "linear-gradient(90deg,#FF5C00,#FF8C42)"
      : "#191d20";

  const badge =
    status === "livre"
      ? { l: "LIVRE", bg: "rgba(122,121,138,0.1)", c: "#7A798A" }
      : status === "pronto"
      ? { l: "● PRONTO", bg: "rgba(46,204,143,0.15)", c: "#2ECC8F" }
      : status === "alerta"
      ? { l: "⚠ ALERTA", bg: "rgba(239,68,68,0.15)", c: "#EF4444" }
      : { l: "OCUPADA", bg: "rgba(255,92,0,0.15)", c: "#FF8C42" };

  return (
    <div
      onClick={onOpen}
      style={{
        background: isLivre ? "rgba(15,17,19,0.6)" : "#131618",
        border: `1px solid ${
          isLivre
            ? "rgba(255,255,255,0.07)"
            : status === "alerta"
            ? "rgba(239,68,68,0.35)"
            : "rgba(255,92,0,0.3)"
        }`,
        borderRadius: 12,
        cursor: "pointer",
        opacity: isLivre ? 0.7 : 1,
        transition: "all 0.2s",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-2px)";
        e.currentTarget.style.opacity = "1";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.opacity = isLivre ? "0.7" : "1";
      }}
    >
      <div style={{ height: 3, background: stripColor }} />
      <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 22,
              fontWeight: 700,
              letterSpacing: "-1px",
              color: isLivre ? "#5f6368" : "#FF8C42",
            }}
          >
            Mesa {mesa.numero}
          </div>
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              padding: "3px 8px",
              borderRadius: 6,
              background: badge.bg,
              color: badge.c,
              letterSpacing: "0.5px",
            }}
          >
            {badge.l}
          </span>
        </div>

        {isLivre ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 8,
              padding: "20px 0",
            }}
          >
            <div style={{ fontSize: 28, opacity: 0.3 }}>🪑</div>
            <div style={{ fontSize: 11, color: "#5f6368" }}>Mesa disponível</div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onOpen();
              }}
              style={{
                padding: "6px 14px",
                background: "transparent",
                border: "1px dashed rgba(255,92,0,0.3)",
                borderRadius: 6,
                color: "#FF8C42",
                fontSize: 11,
                cursor: "pointer",
              }}
            >
              + Abrir Mesa
            </button>
          </div>
        ) : (
          <>
            <div style={{ fontSize: 11, color: "#5f6368", display: "flex", gap: 6 }}>
              <span>👥 {mesa.capacidade} pessoas</span>
              {pedidosCount > 1 && (
                <span style={{ color: "#F5A623" }}>· {pedidosCount} pedidos</span>
              )}
            </div>

            <div
              style={{
                background: "rgba(0,0,0,0.3)",
                border: "0.5px solid rgba(255,255,255,0.06)",
                borderRadius: 8,
                padding: "8px 10px",
                display: "flex",
                flexDirection: "column",
                gap: 4,
                minHeight: 60,
              }}
            >
              {items.length === 0 ? (
                <span style={{ fontSize: 11, color: "#5f6368" }}>
                  Sem itens ainda
                </span>
              ) : (
                <>
                  {items.slice(0, 3).map((it) => (
                    <div
                      key={it.id}
                      style={{
                        display: "flex",
                        gap: 6,
                        fontSize: 11,
                        color: "#9aa0a8",
                        alignItems: "center",
                      }}
                    >
                      <span
                        style={{
                          fontFamily: "'JetBrains Mono', monospace",
                          fontWeight: 700,
                          color: "#FF8C42",
                          minWidth: 18,
                        }}
                      >
                        {it.quantidade}×
                      </span>
                      <span
                        style={{
                          flex: 1,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {it.produto_nome}
                      </span>
                    </div>
                  ))}
                  {items.length > 3 && (
                    <div style={{ fontSize: 10, color: "#5f6368" }}>
                      +{items.length - 3} itens
                    </div>
                  )}
                </>
              )}
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 15,
                  fontWeight: 700,
                  color: "#FF8C42",
                }}
              >
                {brl(total)}
              </div>
              <div
                style={{
                  fontSize: 11,
                  fontFamily: "'JetBrains Mono', monospace",
                  color:
                    tempo > 60 ? "#EF4444" : tempo > 30 ? "#F5A623" : "#5f6368",
                }}
              >
                ⏱ {fmtTempo(tempo)}
              </div>
            </div>

            <div style={{ display: "flex", gap: 6 }}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onAddItem();
                }}
                style={{
                  flex: 1,
                  padding: "6px 0",
                  background: "rgba(255,92,0,0.1)",
                  border: "1px solid rgba(255,92,0,0.3)",
                  borderRadius: 6,
                  color: "#FF8C42",
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                + Item
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onFechar();
                }}
                style={{
                  flex: 1,
                  padding: "6px 0",
                  background: "rgba(46,204,143,0.1)",
                  border: "1px solid rgba(46,204,143,0.3)",
                  borderRadius: 6,
                  color: "#2ECC8F",
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                💳 Fechar
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Modals ──────────────────────────────────────────────────────────────────
function ModalShell({
  title,
  onClose,
  children,
  footer,
  width = 480,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: number;
}) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.75)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backdropFilter: "blur(4px)",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#131618",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 12,
          width: "100%",
          maxWidth: width,
          maxHeight: "85vh",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            padding: "14px 18px",
            borderBottom: "1px solid rgba(255,255,255,0.07)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ fontSize: 15, fontWeight: 600, color: "#e8eaed" }}>
            {title}
          </div>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              color: "#9aa0a8",
              cursor: "pointer",
              fontSize: 18,
            }}
          >
            ✕
          </button>
        </div>
        <div style={{ padding: 18, overflow: "auto", flex: 1 }}>{children}</div>
        {footer && (
          <div
            style={{
              padding: "12px 18px",
              borderTop: "1px solid rgba(255,255,255,0.07)",
              display: "flex",
              gap: 8,
              justifyContent: "flex-end",
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "#0d0f10",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 8,
  padding: "10px 12px",
  color: "#e8eaed",
  fontSize: 13,
  fontFamily: "inherit",
  outline: "none",
};

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  color: "#9aa0a8",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  marginBottom: 6,
  display: "block",
  fontWeight: 600,
};

const btnPrimary: React.CSSProperties = {
  padding: "8px 16px",
  background: "rgba(255,92,0,0.15)",
  border: "1px solid rgba(255,92,0,0.4)",
  borderRadius: 8,
  color: "#FF8C42",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
};

const btnGhost: React.CSSProperties = {
  padding: "8px 16px",
  background: "transparent",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 8,
  color: "#9aa0a8",
  fontSize: 13,
  cursor: "pointer",
};

function NovaMesaModal({
  onClose,
  onConfirm,
}: {
  onClose: () => void;
  onConfirm: (numero: string, capacidade: number) => void;
}) {
  const [numero, setNumero] = useState("");
  const [capacidade, setCapacidade] = useState(4);
  return (
    <ModalShell
      title="Nova Mesa"
      onClose={onClose}
      footer={
        <>
          <button style={btnGhost} onClick={onClose}>
            Cancelar
          </button>
          <button
            style={btnPrimary}
            onClick={() => onConfirm(numero, capacidade)}
          >
            ✓ Criar Mesa
          </button>
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <label style={labelStyle}>Número / Identificação</label>
          <input
            style={inputStyle}
            autoFocus
            value={numero}
            onChange={(e) => setNumero(e.target.value)}
            placeholder="Ex: 1, 2, Varanda 1…"
          />
        </div>
        <div>
          <label style={labelStyle}>Capacidade (pessoas)</label>
          <input
            type="number"
            style={inputStyle}
            value={capacidade}
            min={1}
            max={50}
            onChange={(e) => setCapacidade(parseInt(e.target.value) || 1)}
          />
        </div>
      </div>
    </ModalShell>
  );
}

function NovaComandaModal({
  mesa,
  onClose,
  onConfirm,
}: {
  mesa: Mesa;
  onClose: () => void;
  onConfirm: (pessoas: number, nome: string) => void;
}) {
  const [pessoas, setPessoas] = useState(mesa.capacidade || 2);
  const [nome, setNome] = useState("");
  return (
    <ModalShell
      title={`Abrir Comanda — Mesa ${mesa.numero}`}
      onClose={onClose}
      footer={
        <>
          <button style={btnGhost} onClick={onClose}>
            Cancelar
          </button>
          <button style={btnPrimary} onClick={() => onConfirm(pessoas, nome)}>
            ✓ Abrir Comanda
          </button>
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <label style={labelStyle}>Pessoas</label>
          <input
            type="number"
            style={inputStyle}
            value={pessoas}
            min={1}
            max={50}
            onChange={(e) => setPessoas(parseInt(e.target.value) || 1)}
          />
        </div>
        <div>
          <label style={labelStyle}>Nome / Identificação (opcional)</label>
          <input
            style={inputStyle}
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex: Família Silva, Aniversário João…"
          />
        </div>
      </div>
    </ModalShell>
  );
}

function AddItemModal({
  mesa,
  produtos,
  onClose,
  onConfirm,
}: {
  mesa: Mesa;
  produtos: Produto[];
  onClose: () => void;
  onConfirm: (produto: Produto, qtd: number, obs: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Produto | null>(null);
  const [qtd, setQtd] = useState(1);
  const [obs, setObs] = useState("");

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return produtos.slice(0, 30);
    return produtos
      .filter(
        (p) =>
          p.nome.toLowerCase().includes(s) ||
          (p.categoria || "").toLowerCase().includes(s)
      )
      .slice(0, 30);
  }, [produtos, search]);

  return (
    <ModalShell
      title={`Adicionar Item — Mesa ${mesa.numero}`}
      onClose={onClose}
      width={520}
      footer={
        <>
          <button style={btnGhost} onClick={onClose}>
            Cancelar
          </button>
          <button
            style={{ ...btnPrimary, opacity: selected ? 1 : 0.5 }}
            disabled={!selected}
            onClick={() => selected && onConfirm(selected, qtd, obs)}
          >
            ✓ Adicionar
          </button>
        </>
      }
    >
      {!selected ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <input
            style={inputStyle}
            autoFocus
            placeholder="🔍 Pesquisar produto…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 360, overflow: "auto" }}>
            {filtered.length === 0 ? (
              <div style={{ padding: 20, textAlign: "center", color: "#5f6368", fontSize: 12 }}>
                Nenhum produto encontrado
              </div>
            ) : (
              filtered.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelected(p)}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "10px 12px",
                    background: "#0d0f10",
                    border: "1px solid rgba(255,255,255,0.06)",
                    borderRadius: 8,
                    color: "#e8eaed",
                    cursor: "pointer",
                    textAlign: "left",
                    fontSize: 13,
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 500 }}>{p.nome}</div>
                    {p.categoria && (
                      <div style={{ fontSize: 10, color: "#5f6368" }}>
                        {p.categoria}
                      </div>
                    )}
                  </div>
                  <span style={{ color: "#FF8C42", fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }}>
                    {brl(Number(p.preco_sugerido || 0))}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div
            style={{
              padding: 12,
              background: "#0d0f10",
              borderRadius: 8,
              border: "1px solid rgba(255,92,0,0.3)",
            }}
          >
            <div style={{ fontWeight: 600, color: "#e8eaed" }}>
              {selected.nome}
            </div>
            <div style={{ fontSize: 12, color: "#FF8C42", marginTop: 4 }}>
              {brl(Number(selected.preco_sugerido || 0))} por unidade
            </div>
            <button
              onClick={() => setSelected(null)}
              style={{
                marginTop: 8,
                background: "transparent",
                border: "none",
                color: "#9aa0a8",
                fontSize: 11,
                cursor: "pointer",
                padding: 0,
              }}
            >
              ← Trocar produto
            </button>
          </div>
          <div>
            <label style={labelStyle}>Quantidade</label>
            <input
              type="number"
              style={inputStyle}
              value={qtd}
              min={1}
              onChange={(e) => setQtd(parseInt(e.target.value) || 1)}
            />
          </div>
          <div>
            <label style={labelStyle}>Observação (opcional)</label>
            <input
              style={inputStyle}
              value={obs}
              onChange={(e) => setObs(e.target.value)}
              placeholder="Ex: sem cebola, bem assada…"
            />
          </div>
          <div
            style={{
              padding: 10,
              background: "rgba(255,92,0,0.08)",
              borderRadius: 8,
              fontSize: 13,
              color: "#FF8C42",
              fontWeight: 600,
              textAlign: "right",
              fontFamily: "'JetBrains Mono', monospace",
            }}
          >
            Subtotal: {brl(Number(selected.preco_sugerido || 0) * qtd)}
          </div>
        </div>
      )}
    </ModalShell>
  );
}

function FecharContaModal({
  mesa,
  total,
  onClose,
  onConfirm,
}: {
  mesa: Mesa;
  total: number;
  onClose: () => void;
  onConfirm: (formaPagamento: string) => void;
}) {
  const [fp, setFp] = useState("pix");
  const opts: { v: string; l: string; i: string }[] = [
    { v: "pix", l: "Pix", i: "💠" },
    { v: "credito", l: "Crédito", i: "💳" },
    { v: "debito", l: "Débito", i: "💳" },
    { v: "dinheiro", l: "Dinheiro", i: "💵" },
  ];
  return (
    <ModalShell
      title={`Fechar Conta — Mesa ${mesa.numero}`}
      onClose={onClose}
      footer={
        <>
          <button style={btnGhost} onClick={onClose}>
            Cancelar
          </button>
          <button style={btnPrimary} onClick={() => onConfirm(fp)}>
            ✓ Confirmar Pagamento
          </button>
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div
          style={{
            padding: 14,
            background: "#0d0f10",
            borderRadius: 8,
            border: "1px solid rgba(255,92,0,0.3)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span style={{ color: "#9aa0a8", fontSize: 13 }}>Total</span>
          <span
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 22,
              fontWeight: 700,
              color: "#FF8C42",
            }}
          >
            {brl(total)}
          </span>
        </div>
        <div>
          <label style={labelStyle}>Forma de pagamento</label>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: 8,
            }}
          >
            {opts.map((o) => (
              <button
                key={o.v}
                onClick={() => setFp(o.v)}
                style={{
                  padding: 12,
                  borderRadius: 8,
                  background:
                    fp === o.v ? "rgba(255,92,0,0.15)" : "#0d0f10",
                  border:
                    fp === o.v
                      ? "1px solid rgba(255,92,0,0.4)"
                      : "1px solid rgba(255,255,255,0.07)",
                  color: fp === o.v ? "#FF8C42" : "#9aa0a8",
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 4,
                  fontSize: 11,
                  fontWeight: 600,
                }}
              >
                <span style={{ fontSize: 20 }}>{o.i}</span>
                {o.l}
              </button>
            ))}
          </div>
        </div>
      </div>
    </ModalShell>
  );
}

function DetalheMesaModal({
  mesa,
  info,
  pedidoItens,
  onClose,
  onAddItem,
  onFechar,
}: {
  mesa: Mesa;
  info?: { pedidos: Pedido[]; items: PedidoItem[]; total: number; status: DerivedStatus; tempo: number };
  pedidoItens: Record<string, PedidoItem[]>;
  onClose: () => void;
  onAddItem: () => void;
  onFechar: () => void;
}) {
  if (!info) return null;
  return (
    <ModalShell
      title={`Mesa ${mesa.numero} — Detalhes da Comanda`}
      onClose={onClose}
      width={560}
      footer={
        <>
          <button style={btnGhost} onClick={onClose}>
            Fechar
          </button>
          <button style={btnPrimary} onClick={onAddItem}>
            + Item
          </button>
          <button
            style={{
              ...btnPrimary,
              background: "rgba(46,204,143,0.15)",
              border: "1px solid rgba(46,204,143,0.4)",
              color: "#2ECC8F",
            }}
            onClick={onFechar}
          >
            💳 Fechar Conta
          </button>
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", color: "#9aa0a8", fontSize: 12 }}>
          <span>👥 {mesa.capacidade} pessoas</span>
          <span>⏱ {fmtTempo(info.tempo)} aberta</span>
          <span>{info.pedidos.length} pedido(s)</span>
        </div>
        {info.pedidos.length === 0 ? (
          <div style={{ padding: 30, textAlign: "center", color: "#5f6368" }}>
            Nenhum pedido em aberto
          </div>
        ) : (
          info.pedidos.map((p) => {
            const its = pedidoItens[p.id] || [];
            return (
              <div
                key={p.id}
                style={{
                  background: "#0d0f10",
                  border: "1px solid rgba(255,255,255,0.06)",
                  borderRadius: 8,
                  padding: 12,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: 8,
                    fontSize: 12,
                    color: "#9aa0a8",
                  }}
                >
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", color: "#FF8C42", fontWeight: 700 }}>
                    #{p.codigo_pedido}
                  </span>
                  <span>{p.status}</span>
                </div>
                {its.length === 0 ? (
                  <div style={{ color: "#5f6368", fontSize: 12 }}>Sem itens</div>
                ) : (
                  its.map((it) => (
                    <div
                      key={it.id}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        padding: "4px 0",
                        fontSize: 13,
                        color: "#e8eaed",
                      }}
                    >
                      <span>
                        <span style={{ color: "#FF8C42", fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, marginRight: 8 }}>
                          {it.quantidade}×
                        </span>
                        {it.produto_nome}
                        {it.observacoes && (
                          <div style={{ fontSize: 10, color: "#F5A623", marginLeft: 32 }}>
                            ⚠ {it.observacoes}
                          </div>
                        )}
                      </span>
                      <span style={{ color: "#9aa0a8", fontFamily: "'JetBrains Mono', monospace" }}>
                        {brl(Number(it.valor_total || 0))}
                      </span>
                    </div>
                  ))
                )}
              </div>
            );
          })
        )}
        <div
          style={{
            padding: 14,
            background: "rgba(255,92,0,0.08)",
            borderRadius: 8,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span style={{ color: "#FF8C42", fontWeight: 600 }}>TOTAL</span>
          <span
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 22,
              fontWeight: 700,
              color: "#FF8C42",
            }}
          >
            {brl(info.total)}
          </span>
        </div>
      </div>
    </ModalShell>
  );
}
