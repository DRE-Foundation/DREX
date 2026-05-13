import * as pdfjs from 'https://esm.sh/pdfjs-dist@3.11.174/legacy/build/pdf.js?bundle&target=deno';
import * as pdfWorker from 'https://esm.sh/pdfjs-dist@3.11.174/legacy/build/pdf.worker.js?bundle&target=deno';

type PdfTextItem = {
  str?: string;
  transform?: number[];
};

type ImportedTransaction = {
  title: string;
  amount: number;
  type: 'income' | 'expense' | 'deduction';
};

type PdfModule = {
  getDocument?: (params: unknown) => { promise: Promise<unknown> };
  GlobalWorkerOptions?: {
    workerSrc?: string;
  };
  default?: {
    getDocument?: (params: unknown) => { promise: Promise<unknown> };
    GlobalWorkerOptions?: {
      workerSrc?: string;
    };
  };
};

type PdfWorkerModule = {
  WorkerMessageHandler?: unknown;
  default?: {
    WorkerMessageHandler?: unknown;
  };
};

type PdfDocument = {
  numPages: number;
  getPage: (pageNumber: number) => Promise<{
    getTextContent: () => Promise<{
      items: PdfTextItem[];
    }>;
  }>;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

function base64ToUint8Array(base64: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function parseAmountValue(value: string) {
  const rawValue = String(value || '').trim();

  if (!rawValue) {
    return NaN;
  }

  const withoutCurrency = rawValue.replace(/[^\d,.-]/g, '');
  const hasComma = withoutCurrency.includes(',');
  const hasDot = withoutCurrency.includes('.');

  if (hasComma && hasDot) {
    return Number(withoutCurrency.replace(/\./g, '').replace(',', '.'));
  }

  if (hasComma) {
    return Number(withoutCurrency.replace(',', '.'));
  }

  return Number(withoutCurrency);
}

function classifyTransaction(line: string, amount: number): ImportedTransaction['type'] {
  const normalizedLine = normalizeText(line);

  if (
    normalizedLine.includes('receita') ||
    normalizedLine.includes('entrada') ||
    normalizedLine.includes('credito') ||
    normalizedLine.includes('pix recebido') ||
    normalizedLine.includes('recebimento')
  ) {
    return 'income';
  }

  if (
    normalizedLine.includes('deducao') ||
    normalizedLine.includes('imposto') ||
    normalizedLine.includes('taxa') ||
    normalizedLine.includes('iss') ||
    normalizedLine.includes('inss') ||
    normalizedLine.includes('irrf')
  ) {
    return 'deduction';
  }

  if (
    normalizedLine.includes('despesa') ||
    normalizedLine.includes('saida') ||
    normalizedLine.includes('debito') ||
    normalizedLine.includes('compra') ||
    amount < 0
  ) {
    return 'expense';
  }

  return 'expense';
}

function extractTransactionsFromText(text: string) {
  const moneyPattern =
    /-?\s*(?:R\$\s*)?\d{1,3}(?:\.\d{3})*,\d{2}|-?\s*(?:R\$\s*)?\d+(?:[.,]\d{2})/g;
  const datePattern = /\b\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?\b/;

  return text
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .map((line) => {
      const moneyMatches = line.match(moneyPattern);

      if (!moneyMatches?.length) {
        return null;
      }

      const rawAmount = moneyMatches[moneyMatches.length - 1];
      const amount = parseAmountValue(rawAmount);

      if (Number.isNaN(amount)) {
        return null;
      }

      const title = line
        .replace(datePattern, '')
        .replace(rawAmount, '')
        .replace(/\b(R\$|valor|total|saldo)\b/gi, '')
        .trim();

      return {
        title: title || 'Transacao importada do PDF',
        amount: Math.abs(amount),
        type: classifyTransaction(line, amount),
      };
    })
    .filter((item): item is ImportedTransaction => Boolean(item));
}

async function extractTextFromPdf(fileBase64: string) {
  const pdfModule = pdfjs as PdfModule;
  const workerModule = pdfWorker as PdfWorkerModule;
  const getDocument = pdfModule.getDocument ?? pdfModule.default?.getDocument;
  const workerOptions = pdfModule.GlobalWorkerOptions ?? pdfModule.default?.GlobalWorkerOptions;

  if (!getDocument) {
    throw new Error(`Leitor de PDF nao carregou getDocument. Chaves: ${Object.keys(pdfModule).join(', ')}`);
  }

  if (workerOptions) {
    workerOptions.workerSrc =
      'https://esm.sh/pdfjs-dist@3.11.174/legacy/build/pdf.worker.js?bundle&target=deno';
  }

  const workerMessageHandler =
    workerModule.WorkerMessageHandler ?? workerModule.default?.WorkerMessageHandler;

  if (workerMessageHandler) {
    (globalThis as typeof globalThis & { pdfjsWorker?: unknown }).pdfjsWorker = {
      WorkerMessageHandler: workerMessageHandler,
    };
  }

  const bytes = base64ToUint8Array(fileBase64);
  const loadingTask = getDocument({
    data: bytes,
  });
  const pdf = await loadingTask.promise as PdfDocument;
  const pageLines: string[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const rows = new Map<number, string[]>();

    for (const item of content.items as PdfTextItem[]) {
      if (!item.str?.trim()) {
        continue;
      }

      const y = Math.round(item.transform?.[5] || 0);
      const row = rows.get(y) || [];
      row.push(item.str);
      rows.set(y, row);
    }

    const sortedLines = [...rows.entries()]
      .sort(([firstY], [secondY]) => secondY - firstY)
      .map(([, parts]) => parts.join(' ').trim())
      .filter(Boolean);

    pageLines.push(...sortedLines);
  }

  return pageLines.join('\n');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Metodo nao permitido' }, 405);
  }

  try {
    const { fileBase64 } = await req.json();

    if (!fileBase64 || typeof fileBase64 !== 'string') {
      return jsonResponse({ error: 'PDF em base64 nao enviado' }, 400);
    }

    const text = await extractTextFromPdf(fileBase64);
    const transactions = extractTransactionsFromText(text);

    return jsonResponse({
      transactions,
      extractedTextLength: text.length,
    });
  } catch (error) {
    console.error(error);

    return jsonResponse(
      {
        error: 'Nao foi possivel processar o PDF',
        detail: error instanceof Error ? error.message : String(error),
      },
      500
    );
  }
});
