const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.1-8b-instant';
 
export async function classifyTransaction(
  title: string,
  amount: number,
  type: string,
  availableCategories: string[]
): Promise<string> {
  const apiKey = process.env.EXPO_PUBLIC_GROQ_API_KEY;
  if (!apiKey) throw new Error('EXPO_PUBLIC_GROQ_API_KEY não definida no .env');
 
  const categoriesList = availableCategories.join(', ');
 
  const prompt = `Você é um assistente financeiro brasileiro. Classifique a transação abaixo em UMA das categorias disponíveis.
 
Transação:
- Descrição: "${title}"
- Valor: R$ ${amount.toFixed(2)}
- Tipo: ${type === 'income' ? 'Receita' : type === 'expense' ? 'Despesa' : 'Dedução'}
 
Categorias disponíveis: ${categoriesList}
 
Responda APENAS com o nome exato da categoria, sem explicações, sem pontuação extra.`;
 
  const response = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 20,
      temperature: 0.1,
    }),
  });
 
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Groq API error: ${err}`);
  }
 
  const data = await response.json();
  const result = data.choices?.[0]?.message?.content?.trim() ?? 'Outros';
 
  // Valida se a categoria retornada existe na lista (case-insensitive)
  const found = availableCategories.find(
    (c) => c.toLowerCase() === result.toLowerCase()
  );
  return found ?? 'Outros';
}
