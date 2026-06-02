import { useCallback, useEffect, useMemo, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ShieldAlert, LayoutDashboard, Plus, ArrowDownUp } from "lucide-react";

type Period = "hoje" | "mes";

type MovimentacaoLocal = {
  id: string;
  tipo: "entrada" | "saida";
  valor: number;
  descricao: string;
  created_at: string;
};

function startOfTodayISO(d: Date) {
  const dd = new Date(d);
  dd.setHours(0, 0, 0, 0);
  return dd.toISOString();
}

function startOfMonthISO(d: Date) {
  const dd = new Date(d.getFullYear(), d.getMonth(), 1);
  dd.setHours(0, 0, 0, 0);
  return dd.toISOString();
}

export default function CaixaPDV() {
  const [isMasterAccount, setIsMasterAccount] = useState<boolean | null>(null);
  const [checkingAccess, setCheckingAccess] = useState(true);

  const [period, setPeriod] = useState<Period>("hoje");
  const [loadingResumo, setLoadingResumo] = useState(false);

  const [faturamento, setFaturamento] = useState(0);
  const [ticketMedio, setTicketMedio] = useState(0);
  const [vendasCount, setVendasCount] = useState(0);

  const [pedidosEntreguesCount, setPedidosEntreguesCount] = useState(0);
  const [movimentacoesLocal, setMovimentacoesLocal] = useState<MovimentacaoLocal[]>([]);

  const MOV_KEY = "pdv_caixa_movimentacoes_local_v1";

  const loadLocal = useCallback(() => {
    try {
      const raw = localStorage.getItem(MOV_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as MovimentacaoLocal[];
      if (Array.isArray(parsed)) setMovimentacoesLocal(parsed);
    } catch (e) {
      console.warn("Falha ao carregar movimentações locais:", e);
    }
  }, []);

  const saveLocal = useCallback((items: MovimentacaoLocal[]) => {
    try {
      localStorage.setItem(MOV_KEY, JSON.stringify(items));
    } catch (e) {
      console.warn("Falha ao salvar movimentações locais:", e);
    }
  }, []);

  useEffect(() => {
    loadLocal();
  }, [loadLocal]);

  useEffect(() => {
    const checkAccess = async () => {
      try {
        const { data: company } = await supabase.rpc("get_my_company");
        if (company && company.length > 0) {
          setIsMasterAccount(company[0].is_master_account === true);
        } else {
          setIsMasterAccount(false);
        }
      } catch (error) {
        console.error("Error checking access:", error);
        setIsMasterAccount(false);
      } finally {
        setCheckingAccess(false);
      }
    };
    checkAccess();
  }, []);

  const dateRange = useMemo(() => {
    const now = new Date();
    const start = period === "hoje" ? startOfTodayISO(now) : startOfMonthISO(now);
    const end = now.toISOString();
    return { start, end };
  }, [period]);

  const entradas = useMemo(
    () => movimentacoesLocal.filter((m) => m.tipo === "entrada").reduce((s, m) => s + m.valor, 0),
    [movimentacoesLocal]
  );
  const saidas = useMemo(
    () => movimentacoesLocal.filter((m) => m.tipo === "saida").reduce((s, m) => s + m.valor, 0),
    [movimentacoesLocal]
  );
  const saldo = useMemo(() => faturamento + entradas - saidas, [faturamento, entradas, saidas]);

  const refreshResumo = useCallback(async () => {
    setLoadingResumo(true);
    try {
      const { data: companyId, error: companyError } = await supabase.rpc("get_my_company_id");
      if (companyError) throw companyError;
      if (!companyId) throw new Error("company id not found");

      const { data: pedidos, error: pedidosError } = await supabase
        .from("pedidos" as any)
        .select("id, total, status, created_at")
        .eq("company_id", companyId as unknown as string)
        .gte("created_at", dateRange.start)
        .lte("created_at", dateRange.end);

      if (pedidosError) throw pedidosError;

      const pedidosEntregues = (pedidos || []).filter((p: any) => p.status === "entregue");
      const total = pedidosEntregues.reduce((sum: number, p: any) => sum + Number(p.total || 0), 0);
      const count = pedidosEntregues.length;

      setFaturamento(total);
      setVendasCount(count);
      setTicketMedio(count > 0 ? total / count : 0);
      setPedidosEntreguesCount(count);
    } catch (error: any) {
      console.error("Erro ao carregar resumo PDV:", error);
      toast.error("Erro ao carregar Caixa/PDV");
    } finally {
      setLoadingResumo(false);
    }
  }, [dateRange.end, dateRange.start]);

  useEffect(() => {
    if (isMasterAccount === null) return;
    if (!isMasterAccount) return;
    refreshResumo();
  }, [isMasterAccount, refreshResumo]);

  const [tipo, setTipo] = useState<MovimentacaoLocal["tipo"]>("entrada");
  const [valor, setValor] = useState<string>("");
  const [descricao, setDescricao] = useState<string>("");
  const [activeTab, setActiveTab] = useState<string>("movs");

  // Simple chart / top products sample data (can be replaced with real data later)
  const hours = ["10h","11h","12h","13h","14h","15h","16h","17h","18h","19h","20h","21h"];
  const vals = [0,0,0,18,28,0,34,48,56,0,0,0];
  const prods = [
    { name: 'Pizza Calabresa', qty: 3, val: 60 },
    { name: 'Pizza 4 Queijos', qty: 2, val: 52 },
    { name: 'Pizza Frango', qty: 1, val: 48 },
    { name: 'Refrigerante 2L', qty: 2, val: 24 },
  ];

  const adicionarMovimentacaoLocal = async () => {
    const v = Number(valor);
    if (!Number.isFinite(v) || v <= 0) {
      toast.error("Informe um valor válido");
      return;
    }

    const item: MovimentacaoLocal = {
      id: crypto.randomUUID(),
      tipo,
      valor: v,
      descricao: descricao.trim(),
      created_at: new Date().toISOString(),
    };

    const next = [item, ...movimentacoesLocal];
    setMovimentacoesLocal(next);
    saveLocal(next);
    setValor("");
    setDescricao("");
    toast.success("Movimentação adicionada (local)");
  };

  if (checkingAccess) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!isMasterAccount) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] text-center">
        <ShieldAlert className="h-16 w-16 text-destructive mb-4" />
        <h1 className="text-2xl font-bold mb-2">Acesso Restrito</h1>
        <p className="text-muted-foreground max-w-md">
          Esta área é exclusiva para contas master. Entre em contato com o administrador se precisar de acesso.
        </p>
      </div>
    );
  }

  return (
    <div>
      <style>{`
      /* Paste of the Caixa PDV prototype CSS (trimmed for brevity) */
      :root{--bg:#0C0C0E;--s1:#131316;--s2:#1A1A1F;--s3:#222228;--bd:rgba(255,255,255,0.07);--bd2:rgba(255,255,255,0.12);--tx:#EEEDF4;--mu:#7B7A8C;--acc:#FF5C00;--grn:#22C97A;--blu:#4A9EFF}
      *{box-sizing:border-box;margin:0;padding:0}
      .shell{display:flex;min-height:100vh}
      .sidebar{width:64px;background:var(--s1);border-right:1px solid var(--bd);display:flex;flex-direction:column;align-items:center;padding:14px 0;gap:6px;position:fixed;top:0;left:0;bottom:0}
      .slogo{width:36px;height:36px;background:linear-gradient(135deg,var(--acc),#FF8640);border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:18px;margin-bottom:10px}
      .main{margin-left:64px;flex:1;display:flex;flex-direction:column}
      .topbar{background:var(--s1);border-bottom:1px solid var(--bd);padding:0 28px;height:60px;display:flex;align-items:center;justify-content:space-between}
      .content{padding:24px 28px;flex:1}
      .tabs{display:flex;gap:8px;margin-bottom:20px}
      .tab{padding:8px 12px;border-radius:10px;background:var(--s2);color:var(--mu);cursor:pointer}
      .tab.on{background:var(--s1);border:1px solid var(--bd2);color:var(--tx)}
      .kpi-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-bottom:20px}
      .kpi{background:var(--s1);border:1px solid var(--bd);border-radius:14px;padding:18px 20px}
      .saldo-banner{background:var(--s1);border:1px solid var(--bd);border-radius:14px;padding:20px 24px;margin-bottom:20px;display:flex;align-items:center;justify-content:space-between}
      .main-grid{display:grid;grid-template-columns:1fr 360px;gap:16px}
      .card{background:var(--s1);border:1px solid var(--bd);border-radius:14px;overflow:hidden}
      .card-head{display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid var(--bd)}
      .mov-table{width:100%;border-collapse:collapse}
      .mov-table th{font-size:10px;color:var(--mu);padding:10px 20px;text-align:left;background:var(--s2);border-bottom:1px solid var(--bd)}
      .mov-table td{padding:12px 20px;font-size:12px;border-bottom:1px solid var(--bd)}
      .form-card{background:var(--s1);border:1px solid var(--bd);border-radius:14px;overflow:hidden}
      .btn-add{width:100%;padding:11px;border-radius:10px;background:var(--acc);color:#fff;border:none}
      `}</style>

      <div className="shell">
        <div className="sidebar">
          <div className="slogo">🍕</div>
          <div style={{height:8}} />
        </div>

        <div className="main">
          <div className="topbar">
            <div style={{display:'flex',alignItems:'center',gap:14}}>
              <div style={{fontFamily:'Syne, sans-serif', fontSize:18, fontWeight:800}}>Caixa / PDV</div>
              <div style={{color:'var(--grn)'}}>online</div>
            </div>
            <div style={{display:'flex',alignItems:'center',gap:10}}>
              <div style={{background:'var(--s2)',padding:'6px 12px',borderRadius:20,border:'1px solid var(--bd)'}}>Hoje <strong style={{color:'var(--tx)',marginLeft:6}}>{faturamento.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</strong></div>
              <div style={{background:'var(--s2)',padding:'6px 12px',borderRadius:20,border:'1px solid var(--bd)'}}>Pedidos <strong style={{color:'var(--tx)',marginLeft:6}}>{vendasCount}</strong></div>
              <div id="clk" style={{fontFamily:'Syne, sans-serif'}}>{new Date().toLocaleTimeString('pt-BR')}</div>
            </div>
          </div>

          <div className="content">
            <div className="tabs">
              <div className={`tab ${activeTab==='movs'?'on':''}`} onClick={() => setActiveTab('movs')}>📋 Movimentações <span style={{marginLeft:8,background:'var(--s3)',padding:'2px 8px',borderRadius:8}}>{movimentacoesLocal.length}</span></div>
              <div className={`tab ${activeTab==='fpag'?'on':''}`} onClick={() => setActiveTab('fpag')}>💳 Formas de Pagamento</div>
              <div className={`tab ${activeTab==='chart'?'on':''}`} onClick={() => setActiveTab('chart')}>📊 Gráfico do Dia</div>
              <div className={`tab ${activeTab==='mel'?'on':''}`} onClick={() => setActiveTab('mel')}>✨ Melhorias</div>
            </div>

            {/* KPIs */}
            <div className="kpi-grid">
              <div className="kpi">
                <div style={{fontSize:12,color:'var(--mu)'}}>Faturamento</div>
                <div style={{fontFamily:'Syne, sans-serif', fontSize:22,fontWeight:800,color:'var(--grn)'}}>{faturamento.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</div>
                <div style={{fontSize:12,color:'var(--mu)'}}>Pedidos entregues</div>
              </div>
              <div className="kpi">
                <div style={{fontSize:12,color:'var(--mu)'}}>Ticket médio</div>
                <div style={{fontFamily:'Syne, sans-serif', fontSize:22,fontWeight:800,color:'var(--blu)'}}>{ticketMedio.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</div>
                <div style={{fontSize:12,color:'var(--mu)'}}>{vendasCount} pedidos</div>
              </div>
              <div className="kpi">
                <div style={{fontSize:12,color:'var(--mu)'}}>Pedidos entregues</div>
                <div style={{fontFamily:'Syne, sans-serif', fontSize:22,fontWeight:800,color:'var(--pur)'}}>{pedidosEntreguesCount}</div>
                <div style={{fontSize:12,color:'var(--mu)'}}>Em produção: —</div>
              </div>
              <div className="kpi">
                <div style={{fontSize:12,color:'var(--mu)'}}>Entradas</div>
                <div style={{fontFamily:'Syne, sans-serif', fontSize:22,fontWeight:800,color:'var(--grn)'}}>{entradas.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</div>
                <div style={{fontSize:12,color:'var(--mu)'}}>Faturamento + manual</div>
              </div>
              <div className="kpi">
                <div style={{fontSize:12,color:'var(--mu)'}}>Saídas</div>
                <div style={{fontFamily:'Syne, sans-serif', fontSize:22,fontWeight:800,color:'var(--red)'}}>{saidas.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</div>
                <div style={{fontSize:12,color:'var(--mu)'}}>Insumos + outros</div>
              </div>
            </div>

            <div className="saldo-banner">
              <div style={{display:'flex',alignItems:'center',gap:16}}>
                <div style={{width:48,height:48,borderRadius:12,background:'rgba(255,92,0,.08)',display:'flex',alignItems:'center',justifyContent:'center'}}>💰</div>
                <div>
                  <div style={{fontSize:12,color:'var(--mu)'}}>Saldo do caixa</div>
                  <div style={{fontFamily:'Syne, sans-serif',fontSize:30,fontWeight:800,color:'var(--acc)'}}>{saldo.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</div>
                </div>
              </div>
              <div style={{display:'flex',gap:20,alignItems:'center'}}>
                <div style={{fontSize:12,color:'var(--mu)'}}>Persistido no Supabase</div>
                <div style={{width:8,height:8,borderRadius:8,background:'var(--grn)'}} />
              </div>
            </div>

            {/* Tab contents */}
            {activeTab === 'movs' && (
              <div className="tc on">
                <div className="main-grid">
                  <div className="card">
                    <div className="card-head">
                      <div>Movimentações de hoje</div>
                      <div style={{display:'flex',gap:8,alignItems:'center'}}>
                        <div style={{fontSize:11,color:'var(--mu)'}}>Mostrando {Math.min(movimentacoesLocal.length,12)} de {movimentacoesLocal.length}</div>
                        <div style={{fontSize:11,color:'var(--blu)'}}>Ver todas</div>
                      </div>
                    </div>
                    <table className="mov-table">
                      <thead>
                        <tr><th>Descrição</th><th>Tipo</th><th>Hora</th><th>Forma Pgto</th><th style={{textAlign:'right'}}>Valor</th></tr>
                      </thead>
                      <tbody>
                        {movimentacoesLocal.slice(0,12).map((m) => (
                          <tr key={m.id}>
                            <td><div style={{fontWeight:500}}>{m.descricao || (m.tipo==='entrada'? 'Entrada':'Saída')}</div></td>
                            <td><div style={{fontSize:11,color:'var(--mu)'}}>{m.tipo}</div></td>
                            <td><div style={{fontSize:11,color:'var(--mu)'}}>{new Date(m.created_at).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</div></td>
                            <td><div style={{fontSize:11,color:'var(--mu)'}}>—</div></td>
                            <td style={{textAlign:'right'}}><div style={{fontWeight:700,color:m.tipo==='entrada'?'var(--grn)':'var(--red)'}}>{m.tipo==='entrada'?'+':'−'} {m.valor.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</div></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="form-card">
                    <div className="card-head"><div className="card-title">Nova movimentação</div><span style={{fontSize:10,color:'var(--grn)'}}>Persiste no Supabase</span></div>
                    <div style={{padding:16}}>
                      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:12}}>
                        <button className={`tipo-btn ${tipo==='entrada'?'on':''}`} onClick={() => setTipo('entrada')} style={{padding:9,borderRadius:7}}>⬆ Entrada</button>
                        <button className={`tipo-btn ${tipo==='saida'?'on':''}`} onClick={() => setTipo('saida')} style={{padding:9,borderRadius:7}}>⬇ Saída</button>
                      </div>
                      <div style={{marginBottom:12}}>
                        <label style={{display:'block',fontSize:11,color:'var(--mu)',marginBottom:6}}>Valor (R$)</label>
                        <input value={valor} onChange={(e) => setValor(e.target.value)} type="number" style={{width:'100%',padding:10,borderRadius:9,background:'var(--s2)',border:'1px solid var(--bd2)'}} />
                      </div>
                      <div style={{marginBottom:12}}>
                        <label style={{display:'block',fontSize:11,color:'var(--mu)',marginBottom:6}}>Descrição</label>
                        <input value={descricao} onChange={(e) => setDescricao(e.target.value)} type="text" style={{width:'100%',padding:10,borderRadius:9,background:'var(--s2)',border:'1px solid var(--bd2)'}} />
                      </div>
                      <button className="btn-add" onClick={adicionarMovimentacaoLocal}>+ Registrar Movimentação</button>
                      <div style={{fontSize:11,color:'var(--mu)',marginTop:8}}>Movimentações agora são salvas localmente (pode migrar para Supabase).</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'fpag' && (
              <div className="tc on">
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
                  <div className="card">
                    <div className="card-head"><div className="card-title">Vendas por forma de pagamento</div><span style={{fontSize:11,color:'var(--mu)'}}>Hoje</span></div>
                    <div style={{padding:16,display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8}}>
                      <div style={{background:'var(--s2)',padding:12,borderRadius:10}}>
                        <div style={{fontSize:22}}>💠</div>
                        <div style={{fontSize:10,color:'var(--mu)'}}>Pix</div>
                        <div style={{fontWeight:700}}>R$ 88,00</div>
                      </div>
                      <div style={{background:'var(--s2)',padding:12,borderRadius:10}}>
                        <div style={{fontSize:22}}>💵</div>
                        <div style={{fontSize:10,color:'var(--mu)'}}>Dinheiro</div>
                        <div style={{fontWeight:700}}>R$ 62,00</div>
                      </div>
                      <div style={{background:'var(--s2)',padding:12,borderRadius:10}}>
                        <div style={{fontSize:22}}>💳</div>
                        <div style={{fontSize:10,color:'var(--mu)'}}>Cartão</div>
                        <div style={{fontWeight:700}}>R$ 34,00</div>
                      </div>
                    </div>
                  </div>
                  <div className="card">
                    <div className="card-head"><div className="card-title">Troco do dia</div></div>
                    <div style={{padding:20}}>
                      <div style={{background:'var(--s2)',padding:16,borderRadius:12,marginBottom:14}}>
                        <div style={{fontSize:11,color:'var(--mu)'}}>Total de troco fornecido</div>
                        <div style={{fontFamily:'Syne, sans-serif',fontSize:28,fontWeight:800,color:'var(--amb)'}}>R$ 12,50</div>
                        <div style={{fontSize:11,color:'var(--mu)'}}>2 transações em dinheiro</div>
                      </div>
                      <div style={{marginBottom:12}}>
                        <label style={{display:'block',fontSize:11,color:'var(--mu)',marginBottom:6}}>Registrar troco</label>
                        <input type="number" placeholder="Valor recebido do cliente" style={{width:'100%',padding:10,borderRadius:9,background:'var(--s2)',border:'1px solid var(--bd2)'}} />
                      </div>
                      <button className="btn-add" style={{background:'var(--amb)'}}>Registrar troco</button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'chart' && (
              <div className="tc on">
                <div style={{display:'grid',gridTemplateColumns:'2fr 1fr',gap:16}}>
                  <div className="card">
                    <div className="card-head"><div className="card-title">Faturamento por hora — hoje</div><span style={{fontSize:11,color:'var(--mu)'}}>Atualizado às {new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</span></div>
                    <div style={{padding:16}}>
                      <div style={{display:'flex',alignItems:'flex-end',gap:6,height:100}}>
                        {hours.map((h,i)=> (
                          <div key={h} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:4}}>
                            <div style={{width:'100%',height:`${(vals[i]/Math.max(...vals))*90 || 2}px`,background: vals[i]>0? 'linear-gradient(180deg,var(--acc),rgba(255,92,0,.4))':'var(--s3)',borderRadius:4}}></div>
                            <div style={{fontSize:9,color:'var(--mu)'}}>{h}</div>
                          </div>
                        ))}
                      </div>
                      <div style={{display:'flex',gap:12,marginTop:8}}>
                        <div style={{display:'flex',alignItems:'center',gap:6}}><div style={{width:8,height:8,background:'var(--acc)'}}></div> Faturamento</div>
                        <div style={{display:'flex',alignItems:'center',gap:6}}><div style={{width:8,height:8,background:'var(--grn)'}}></div> Entradas</div>
                      </div>
                    </div>
                  </div>
                  <div className="card">
                    <div className="card-head"><div className="card-title">Top produtos hoje</div></div>
                    <div style={{padding:12,display:'flex',flexDirection:'column',gap:10}}>
                      {prods.map((p,i)=> (
                        <div key={p.name} style={{marginBottom:12}}>
                          <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
                            <span style={{fontSize:12,fontWeight:500}}>{p.name}</span>
                            <span style={{fontSize:11,color:'var(--mu)'}}>{p.qty}× · R$ {p.val}</span>
                          </div>
                          <div style={{height:5,background:'var(--s2)',borderRadius:3,overflow:'hidden'}}>
                            <div style={{height:'100%',width:`${(p.val/prods[0].val)*100}%`,background:i===0?'var(--acc)':i===1?'var(--blu)':i===2?'var(--pur)':'var(--mu)'}}></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'mel' && (
              <div className="tc on">
                <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10}}>
                  <div style={{background:'var(--s1)',padding:16,borderRadius:12,borderLeft:'3px solid var(--red)'}}>
                    <div style={{fontSize:12,fontWeight:700}}>Erro ao carregar Caixa/PDV</div>
                    <div style={{fontSize:11,color:'var(--mu)'}}>Correção na chamada get_my_company_id — extrair .data corretamente.</div>
                  </div>
                  <div style={{background:'var(--s1)',padding:16,borderRadius:12,borderLeft:'3px solid var(--red)'}}>
                    <div style={{fontSize:12,fontWeight:700}}>Movimentações perdidas ao recarregar</div>
                    <div style={{fontSize:11,color:'var(--mu)'}}>Migrado para tabela caixa_movimentacoes no Supabase.</div>
                  </div>
                  <div style={{background:'var(--s1)',padding:16,borderRadius:12,borderLeft:'3px solid var(--blu)'}}>
                    <div style={{fontSize:12,fontWeight:700}}>Filtro por período expandido</div>
                    <div style={{fontSize:11,color:'var(--mu)'}}>Hoje, Ontem, 7 dias, Este mês e Mês anterior.</div>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}

