// src/lib/groq/chatFinanceiro.ts

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.1-8b-instant';

// Limite seguro de chars para o contexto (evita estourar 6000 TPM)
const MAX_CONTEXT_CHARS = 2800;

export interface Transaction {
  id: string;
  title: string | null;
  amount: number | null;
  type: string | null;
  created_at: string | null;
  category: string | null;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

// ─────────────────────────────────────────────
// Helpers — processamento local, sem custo de tokens
// ─────────────────────────────────────────────

function somaTotal(transactions: Transaction[], tipo: string) {
  return transactions
    .filter((t) => t.type === tipo)
    .reduce((sum, t) => sum + (t.amount ?? 0), 0);
}

function gastosPorCategoria(transactions: Transaction[]) {
  const map: Record<string, number> = {};
  for (const t of transactions) {
    if (t.type !== 'expense') continue;
    const cat = t.category ?? 'Outros';
    map[cat] = (map[cat] ?? 0) + (t.amount ?? 0);
  }
  return Object.entries(map)
    .sort((a, b) => b[1] - a[1])
    .map(([cat, val]) => `${cat}: R$ ${val.toFixed(2)}`)
    .join('\n');
}

function topTransacoes(transactions: Transaction[], tipo: string, limite = 15) {
  return transactions
    .filter((t) => t.type === tipo)
    .sort((a, b) => (b.amount ?? 0) - (a.amount ?? 0))
    .slice(0, limite)
    .map((t) => {
      const data = t.created_at
        ? new Date(t.created_at).toLocaleDateString('pt-BR')
        : '?';
      return `[${data}] ${t.title ?? 'sem título'} | R$ ${(t.amount ?? 0).toFixed(2)} | ${t.category ?? 'Outros'}`;
    })
    .join('\n');
}

function resumoPorMes(transactions: Transaction[]) {
  const map: Record<string, { receitas: number; despesas: number }> = {};
  for (const t of transactions) {
    if (!t.created_at) continue;
    const mes = t.created_at.slice(0, 7); // "2024-03"
    if (!map[mes]) map[mes] = { receitas: 0, despesas: 0 };
    if (t.type === 'income') map[mes].receitas += t.amount ?? 0;
    if (t.type === 'expense') map[mes].despesas += t.amount ?? 0;
  }
  return Object.entries(map)
    .sort((a, b) => b[0].localeCompare(a[0]))
    .slice(0, 6)
    .map(
      ([mes, v]) =>
        `${mes}: receitas R$ ${v.receitas.toFixed(2)} | despesas R$ ${v.despesas.toFixed(2)}`
    )
    .join('\n');
}

/**
 * Detecta a intenção da pergunta e monta um contexto compacto e relevante,
 * evitando enviar todas as transações brutas para a API.
 */
function buildContexto(userMessage: string, transactions: Transaction[]): string {
  const msg = userMessage.toLowerCase();

  const totalReceitas = somaTotal(transactions, 'income');
  const totalDespesas = somaTotal(transactions, 'expense');
  const saldo = totalReceitas - totalDespesas;

  // Resumo financeiro geral — sempre incluído
  let contexto = `TOTAL DE TRANSAÇÕES: ${transactions.length}
RECEITAS TOTAIS: R$ ${totalReceitas.toFixed(2)}
DESPESAS TOTAIS: R$ ${totalDespesas.toFixed(2)}
SALDO: R$ ${saldo.toFixed(2)}`;

  // Intenção: categorias / onde gastou
  if (
    msg.includes('categor') ||
    msg.includes('gast') ||
    msg.includes('uber') ||
    msg.includes('ifood') ||
    msg.includes('alimenta') ||
    msg.includes('operacion') ||
    msg.includes('transport') ||
    msg.includes('maior')
  ) {
    contexto += `\n\nGASTOS POR CATEGORIA:\n${gastosPorCategoria(transactions)}`;
  }

  // Intenção: receitas / entradas
  if (
    msg.includes('receb') ||
    msg.includes('receita') ||
    msg.includes('salário') ||
    msg.includes('salario') ||
    msg.includes('renda') ||
    msg.includes('entrada')
  ) {
    contexto += `\n\nPRINCIPAIS RECEITAS:\n${topTransacoes(transactions, 'income', 10)}`;
  }

  // Intenção: histórico mensal
  if (
    msg.includes('mês') ||
    msg.includes('mes') ||
    msg.includes('mensal') ||
    msg.includes('histórico') ||
    msg.includes('historico') ||
    msg.includes('período') ||
    msg.includes('periodo')
  ) {
    contexto += `\n\nRESUMO POR MÊS (últimos 6 meses):\n${resumoPorMes(transactions)}`;
  }

  // Intenção: detalhes / lista de transações específicas
  if (
    msg.includes('quando') ||
    msg.includes('lista') ||
    msg.includes('quais') ||
    msg.includes('mostre') ||
    msg.includes('detalh') ||
    msg.includes('últimas') ||
    msg.includes('ultimas')
  ) {
    // Tenta encontrar um termo de busca específico na mensagem
    const stopWords = new Set([
      'quando', 'quais', 'liste', 'mostre', 'foram', 'minhas', 'meus',
      'com', 'para', 'esse', 'este', 'você', 'voce', 'gastei', 'ultimas',
      'últimas', 'detalhe', 'detalhes', 'mostra', 'lista', 'sobre',
    ]);
    const termoBusca = userMessage
      .toLowerCase()
      .split(/\s+/)
      .find((p) => p.length > 3 && !stopWords.has(p));

    if (termoBusca) {
      const filtradas = transactions
        .filter(
          (t) =>
            t.title?.toLowerCase().includes(termoBusca) ||
            t.category?.toLowerCase().includes(termoBusca)
        )
        .slice(0, 20)
        .map((t) => {
          const data = t.created_at
            ? new Date(t.created_at).toLocaleDateString('pt-BR')
            : '?';
          return `[${data}] ${t.title ?? 'sem título'} | R$ ${(t.amount ?? 0).toFixed(2)} | ${t.category ?? 'Outros'}`;
        })
        .join('\n');

      if (filtradas) {
        contexto += `\n\nTRANSAÇÕES RELACIONADAS A "${termoBusca}":\n${filtradas}`;
      }
    } else {
      // Sem termo: mostra as últimas 15 despesas e 5 receitas
      contexto += `\n\nÚLTIMAS DESPESAS:\n${topTransacoes(transactions, 'expense', 15)}`;
      contexto += `\n\nÚLTIMAS RECEITAS:\n${topTransacoes(transactions, 'income', 5)}`;
    }
  }

  // Garante que não ultrapassa o limite de chars
  if (contexto.length > MAX_CONTEXT_CHARS) {
    contexto =
      contexto.slice(0, MAX_CONTEXT_CHARS) +
      '\n[dados truncados para respeitar limite da API]';
  }

  return contexto;
}

// ─────────────────────────────────────────────
// Função principal exportada
// ─────────────────────────────────────────────

export async function chatFinanceiro(
  userMessage: string,
  transactions: Transaction[],
  history: ChatMessage[]
): Promise<string> {
  const apiKey = process.env.EXPO_PUBLIC_GROQ_API_KEY;
  if (!apiKey) throw new Error('EXPO_PUBLIC_GROQ_API_KEY não definida no .env');

  const contexto = buildContexto(userMessage, transactions);

  const systemPrompt = `Você é um assistente financeiro pessoal brasileiro, simpático e direto.
Analise os dados do extrato abaixo e responda a pergunta do usuário.

EXTRATO DO USUÁRIO:
${contexto}

REGRAS:
- Responda em português brasileiro, de forma clara e objetiva.
- Use os dados acima. Nunca invente transações que não estão listadas.
- Ao mencionar valores, use o formato R$ 0,00.
- Se não tiver dados suficientes, diga claramente.
- Seja direto e conciso.`;

  // Limita o histórico a últimas 4 mensagens para economizar tokens
  const historicoCurto = history.slice(-4);

  const messages = [
    ...historicoCurto.map((msg) => ({ role: msg.role, content: msg.content })),
    { role: 'user' as const, content: userMessage },
  ];

  const response = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
      max_tokens: 512,
      temperature: 0.2,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Groq API error: ${err}`);
  }

  const data = await response.json();
  return (
    data.choices?.[0]?.message?.content?.trim() ??
    'Não consegui gerar uma resposta.'
  );
}