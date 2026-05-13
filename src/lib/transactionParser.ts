type TransactionType = 'income' | 'expense' | 'deduction';

export type SheetRow = Record<string, unknown>;

export type ImportedTransaction = {
  id: string;
  title: string;
  amount: string;
  type: TransactionType;
};

// ─── Normalização ─────────────────────────────────────────────────────────────

export function normalizeText(value: unknown): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function normalizeColumnName(value: unknown): string {
  return normalizeText(value).replace(/[^a-z0-9]/g, '');
}

// ─── Valores ──────────────────────────────────────────────────────────────────

export function parseAmountValue(value: unknown): number {
  const rawValue = String(value || '').trim();
  if (!rawValue) return NaN;

  const withoutCurrency = rawValue.replace(/[^\d,.-]/g, '');
  const hasComma = withoutCurrency.includes(',');
  const hasDot = withoutCurrency.includes('.');

  if (hasComma && hasDot) return Number(withoutCurrency.replace(/\./g, '').replace(',', '.'));
  if (hasComma) return Number(withoutCurrency.replace(',', '.'));
  return Number(withoutCurrency);
}

export function getRowValue(row: SheetRow, candidates: string[]): unknown {
  const entries = Object.entries(row);
  const normalizedCandidates = candidates.map(normalizeColumnName);
  const found = entries.find(([key]) => {
    const normalizedKey = normalizeColumnName(key);
    return normalizedCandidates.some(
      (c) => normalizedKey === c || normalizedKey.includes(c)
    );
  });
  return found?.[1];
}

// ─── CSV ──────────────────────────────────────────────────────────────────────

function parseCsvLine(line: string, separator: string): string[] {
  const values: string[] = [];
  let currentValue = '';
  let insideQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"' && next === '"') { currentValue += '"'; i++; continue; }
    if (char === '"') { insideQuotes = !insideQuotes; continue; }
    if (char === separator && !insideQuotes) { values.push(currentValue.trim()); currentValue = ''; continue; }
    currentValue += char;
  }

  values.push(currentValue.trim());
  return values;
}

export function csvToRows(csvContent: string): SheetRow[] {
  const normalized = csvContent.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
  const lines = normalized
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.replace(/[;,]/g, '').trim());

  if (lines.length < 2) return [];

  const headerLine = lines[0];
  const separator = (headerLine.match(/;/g) || []).length > (headerLine.match(/,/g) || []).length ? ';' : ',';
  const headers = parseCsvLine(headerLine, separator);

  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line, separator);
    return headers.reduce<SheetRow>((row, header, i) => {
      row[header] = values[i] || '';
      return row;
    }, {});
  });
}

// ─── Classificação ────────────────────────────────────────────────────────────

function getFallbackTitle(row: SheetRow): string {
  const firstText = Object.values(row).find((value) => {
    return String(value || '').trim() && isNaN(parseAmountValue(value));
  });
  return String(firstText || 'Transacao importada').trim();
}

function classifyTransaction(row: SheetRow, amountValue: number): TransactionType {
  const typeValue = normalizeText(
    getRowValue(row, ['tipo', 'type', 'categoria', 'classificacao', 'natureza'])
  );
  const rowText = normalizeText(Object.values(row).join(' '));

  if (['receita', 'entrada', 'credito', 'income'].some((k) => typeValue.includes(k))) return 'income';
  if (['deducao', 'imposto', 'taxa'].some((k) => typeValue.includes(k) || rowText.includes(k))) return 'deduction';
  if (['despesa', 'saida', 'debito', 'expense'].some((k) => typeValue.includes(k)) || amountValue < 0) return 'expense';

  return 'expense';
}

// ─── Conversão principal ──────────────────────────────────────────────────────

export function rowsToTransactions(rows: SheetRow[]): ImportedTransaction[] {
  return rows
    .map((row, index) => {
      const amountColumnValue =
        getRowValue(row, ['valor', 'amount', 'total', 'preco', 'value']) ??
        getRowValue(row, ['debito', 'debito r$', 'saida']) ??
        getRowValue(row, ['credito', 'credito r$', 'entrada']);

      const parsedAmount = parseAmountValue(amountColumnValue);
      if (isNaN(parsedAmount)) return null;

      const titleValue =
        getRowValue(row, ['descricao', 'description', 'titulo', 'title', 'historico', 'lancamento']) ??
        getFallbackTitle(row);

      return {
        id: `${Date.now()}-${index}`,
        title: String(titleValue || 'Transacao importada').trim(),
        amount: String(Math.abs(parsedAmount)),
        type: classifyTransaction(row, parsedAmount),
      };
    })
    .filter((item): item is ImportedTransaction => Boolean(item));
}