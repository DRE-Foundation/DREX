import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import * as XLSX from 'xlsx';

type TransactionType = 'income' | 'expense' | 'deduction';

type ImportedTransaction = {
  id: string;
  title: string;
  amount: string;
  type: TransactionType;
};

type SheetRow = Record<string, unknown>;

const fileTypes = [
  '*/*',
  'text/csv',
  'text/comma-separated-values',
  'application/csv',
  'application/pdf',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

const typeLabels: Record<TransactionType, string> = {
  income: 'Receita',
  expense: 'Despesa',
  deduction: 'Deducao',
};

export default function NewTransaction() {
  const router = useRouter();

  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<TransactionType>('expense');
  const [importedTransactions, setImportedTransactions] = useState<ImportedTransaction[]>([]);
  const [selectedFileName, setSelectedFileName] = useState('');
  const [isImporting, setIsImporting] = useState(false);

  function normalizeText(value: unknown) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  function normalizeColumnName(value: unknown) {
    return normalizeText(value).replace(/[^a-z0-9]/g, '');
  }

  function parseAmountValue(value: unknown) {
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

  function getRowValue(row: SheetRow, candidates: string[]) {
    const entries = Object.entries(row);
    const normalizedCandidates = candidates.map(normalizeColumnName);
    const found = entries.find(([key]) => {
      const normalizedKey = normalizeColumnName(key);

      return normalizedCandidates.some(
        (candidate) => normalizedKey === candidate || normalizedKey.includes(candidate)
      );
    });

    return found?.[1];
  }

  function parseCsvLine(line: string, separator: string) {
    const values: string[] = [];
    let currentValue = '';
    let insideQuotes = false;

    for (let index = 0; index < line.length; index += 1) {
      const char = line[index];
      const nextChar = line[index + 1];

      if (char === '"' && nextChar === '"') {
        currentValue += '"';
        index += 1;
        continue;
      }

      if (char === '"') {
        insideQuotes = !insideQuotes;
        continue;
      }

      if (char === separator && !insideQuotes) {
        values.push(currentValue.trim());
        currentValue = '';
        continue;
      }

      currentValue += char;
    }

    values.push(currentValue.trim());
    return values;
  }

  function csvToRows(csvContent: string) {
    const normalizedContent = csvContent.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
    const lines = normalizedContent
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.replace(/[;,]/g, '').trim());

    if (lines.length < 2) {
      return [];
    }

    const headerLine = lines[0];
    const separator = (headerLine.match(/;/g) || []).length > (headerLine.match(/,/g) || []).length
      ? ';'
      : ',';
    const headers = parseCsvLine(headerLine, separator);

    return lines.slice(1).map((line) => {
      const values = parseCsvLine(line, separator);

      return headers.reduce<SheetRow>((row, header, index) => {
        row[header] = values[index] || '';
        return row;
      }, {});
    });
  }

  function getFallbackTitle(row: SheetRow) {
    const firstTextValue = Object.values(row).find((value) => {
      const parsedAmount = parseAmountValue(value);
      return String(value || '').trim() && isNaN(parsedAmount);
    });

    return String(firstTextValue || 'Transacao importada').trim();
  }

  function classifyTransaction(row: SheetRow, amountValue: number): TransactionType {
    const typeValue = normalizeText(
      getRowValue(row, ['tipo', 'type', 'categoria', 'classificacao', 'natureza'])
    );
    const rowText = normalizeText(Object.values(row).join(' '));

    if (
      typeValue.includes('receita') ||
      typeValue.includes('entrada') ||
      typeValue.includes('credito') ||
      typeValue.includes('income')
    ) {
      return 'income';
    }

    if (
      typeValue.includes('deducao') ||
      typeValue.includes('imposto') ||
      typeValue.includes('taxa') ||
      rowText.includes('deducao') ||
      rowText.includes('imposto')
    ) {
      return 'deduction';
    }

    if (
      typeValue.includes('despesa') ||
      typeValue.includes('saida') ||
      typeValue.includes('debito') ||
      typeValue.includes('expense') ||
      amountValue < 0
    ) {
      return 'expense';
    }

    return 'expense';
  }

  function rowsToTransactions(rows: SheetRow[]) {
    return rows
      .map((row, index) => {
        const amountColumnValue =
          getRowValue(row, ['valor', 'amount', 'total', 'preco', 'value']) ??
          getRowValue(row, ['debito', 'debito r$', 'saida']) ??
          getRowValue(row, ['credito', 'credito r$', 'entrada']);

        const parsedAmount = parseAmountValue(amountColumnValue);

        if (isNaN(parsedAmount)) {
          return null;
        }

        const titleValue =
          getRowValue(row, ['descricao', 'description', 'titulo', 'title', 'historico', 'lancamento']) ??
          getFallbackTitle(row);

        const transactionType = classifyTransaction(row, parsedAmount);

        return {
          id: `${Date.now()}-${index}`,
          title: String(titleValue || 'Transacao importada').trim(),
          amount: String(Math.abs(parsedAmount)),
          type: transactionType,
        };
      })
      .filter((item): item is ImportedTransaction => Boolean(item));
  }

  function requestFileAccessConfirmation() {
    // Na web não precisa pedir confirmação de acesso
    if (Platform.OS === 'web') {
      return Promise.resolve(true);
    }

    return new Promise<boolean>((resolve) => {
      Alert.alert(
        'Acesso aos arquivos',
        'Para importar CSV, Excel ou PDF, permita que o app abra o seletor de arquivos do telefone.',
        [
          {
            text: 'Cancelar',
            style: 'cancel',
            onPress: () => resolve(false),
          },
          {
            text: 'Continuar',
            onPress: () => resolve(true),
          },
        ]
      );
    });
  }

  // ─── Leitura de arquivos ──────────────────────────────────────────────────────

  function workbookToRows(workbook: XLSX.WorkBook) {
    const firstSheetName = workbook.SheetNames[0];

    if (!firstSheetName) {
      return [];
    }

    return XLSX.utils.sheet_to_json<SheetRow>(workbook.Sheets[firstSheetName], {
      defval: '',
    });
  }

  async function readAssetAsText(file: DocumentPicker.DocumentPickerAsset) {
    if (Platform.OS === 'web') {
      if (file.file?.text) return file.file.text();
      return (await fetch(file.uri)).text();
    }

    if (file.file?.text) {
      return file.file.text();
    }

    try {
      return await FileSystem.readAsStringAsync(file.uri);
    } catch (fileSystemError) {
      console.log('FileSystem text read failed', fileSystemError);
    }

    const response = await fetch(file.uri);
    return response.text();
  }

  async function readAssetAsWorkbook(file: DocumentPicker.DocumentPickerAsset) {
    if (Platform.OS === 'web') {
      if (file.file?.arrayBuffer) return XLSX.read(await file.file.arrayBuffer(), { type: 'array' });
      return XLSX.read(await (await fetch(file.uri)).arrayBuffer(), { type: 'array' });
    }

    if (file.file?.arrayBuffer) {
      return XLSX.read(await file.file.arrayBuffer(), { type: 'array' });
    }

    if (file.base64) {
      return XLSX.read(file.base64, { type: 'base64' });
    }

    try {
      const fileContent = await FileSystem.readAsStringAsync(file.uri, {
        encoding: 'base64',
      });

      return XLSX.read(fileContent, { type: 'base64' });
    } catch (fileSystemError) {
      console.log('FileSystem base64 read failed', fileSystemError);
    }

    const response = await fetch(file.uri);
    return XLSX.read(await response.arrayBuffer(), { type: 'array' });
  }

  async function readAssetAsBase64(file: DocumentPicker.DocumentPickerAsset) {
    if (file.base64) {
      return file.base64;
    }

    if (Platform.OS === 'web') {
      const buf = await (await fetch(file.uri)).arrayBuffer();
      const bytes = new Uint8Array(buf);
      let bin = '';
      bytes.forEach((b) => (bin += String.fromCharCode(b)));
      return btoa(bin);
    }

    return FileSystem.readAsStringAsync(file.uri, {
      encoding: 'base64',
    });
  }

  async function getRowsFromPickedFile(file: DocumentPicker.DocumentPickerAsset, isCsv: boolean) {
    if (isCsv) {
      try {
        const csvRows = csvToRows(await readAssetAsText(file));

        if (csvRows.length) {
          return csvRows;
        }
      } catch (textError) {
        console.log('CSV text parse failed', textError);
      }
    }

    return workbookToRows(await readAssetAsWorkbook(file));
  }

  async function getTransactionsFromPdf(file: DocumentPicker.DocumentPickerAsset) {
    const fileBase64 = await readAssetAsBase64(file);
    const { data, error } = await supabase.functions.invoke('import-pdf-transactions', {
      body: {
        fileName: file.name,
        fileBase64,
      },
    });

    if (error) {
      throw new Error(
        `A funcao import-pdf-transactions retornou erro: ${error.message}`
      );
    }

    if (!Array.isArray(data?.transactions)) {
      return [];
    }

    return rowsToTransactions(data.transactions);
  }

  function getErrorMessage(error: unknown) {
    if (error instanceof Error) {
      return error.message;
    }

    return String(error);
  }

  async function handleImportFile() {
    try {
      const canOpenFiles = await requestFileAccessConfirmation();

      if (!canOpenFiles) {
        return;
      }

      const result = await DocumentPicker.getDocumentAsync({
        type: fileTypes,
        copyToCacheDirectory: true,
        multiple: false,
        ...(Platform.OS !== 'web' && { base64: true }),
      });

      if (result.canceled) {
        return;
      }

      setIsImporting(true);

      const file = result.assets[0];
      const fileName = file.name || 'arquivo importado';
      const extension = fileName.split('.').pop()?.toLowerCase();
      const isCsv = extension === 'csv' || Boolean(file.mimeType?.includes('csv'));
      const isPdf = extension === 'pdf' || file.mimeType === 'application/pdf';

      if (!['csv', 'xls', 'xlsx', 'pdf'].includes(extension || '')) {
        Alert.alert('Formato nao suportado', 'Selecione um arquivo CSV, XLS, XLSX ou PDF');
        return;
      }

      const transactions = isPdf
        ? await getTransactionsFromPdf(file)
        : rowsToTransactions(await getRowsFromPickedFile(file, isCsv));

      if (!transactions.length) {
        Alert.alert(
          'Arquivo lido',
          isPdf
            ? 'Nenhuma transacao foi encontrada. Se o PDF for uma imagem escaneada, vamos precisar de OCR no proximo passo.'
            : 'Nenhuma transacao foi encontrada para revisar'
        );
        return;
      }

      setSelectedFileName(fileName);
      setImportedTransactions(transactions);
      Alert.alert('Arquivo lido', `${transactions.length} transacoes foram encontradas para revisao`);
    } catch (error) {
      console.log(error);
      Alert.alert(
        'Erro',
        `Nao foi possivel importar o arquivo. Detalhe: ${getErrorMessage(error)}`
      );
    } finally {
      setIsImporting(false);
    }
  }

  function updateImportedTransaction(
    id: string,
    field: keyof Omit<ImportedTransaction, 'id'>,
    value: string
  ) {
    setImportedTransactions((current) =>
      current.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  }

  function removeImportedTransaction(id: string) {
    setImportedTransactions((current) => current.filter((item) => item.id !== id));
  }

  async function handleConfirmImport() {
    const validTransactions = importedTransactions
      .map((item) => ({
        ...item,
        parsedAmount: parseAmountValue(item.amount),
      }))
      .filter((item) => item.title.trim() && !isNaN(item.parsedAmount));

    if (!validTransactions.length) {
      Alert.alert('Erro', 'Revise as transacoes antes de confirmar');
      return;
    }

    const { data, error: userError } = await supabase.auth.getUser();

    if (userError || !data.user) {
      Alert.alert('Erro', 'Usuario nao autenticado');
      return;
    }

    const { error } = await supabase.from('transactions').insert(
      validTransactions.map((item) => ({
        title: item.title.trim(),
        amount: Math.abs(item.parsedAmount),
        type: item.type,
        user_id: data.user.id,
      }))
    );

    if (error) {
      console.log(error);
      Alert.alert('Erro', 'Nao foi possivel salvar a importacao');
      return;
    }

    Alert.alert('Sucesso', 'Transacoes importadas com sucesso!');
    router.back();
  }

  async function handleSave() {
    if (!title || !amount) {
      Alert.alert('Erro', 'Preencha todos os campos');
      return;
    }

    const parsedAmount = parseFloat(amount);

    if (isNaN(parsedAmount)) {
      Alert.alert('Erro', 'Valor invalido');
      return;
    }

    const { data, error: userError } = await supabase.auth.getUser();

    if (userError || !data.user) {
      Alert.alert('Erro', 'Usuario nao autenticado');
      return;
    }

    const { error } = await supabase.from('transactions').insert([
      {
        title,
        amount: parsedAmount,
        type,
        user_id: data.user.id,
      },
    ]);

    if (error) {
      console.log(error);
      Alert.alert('Erro ao salvar');
      return;
    }

    Alert.alert('Sucesso', 'Transacao salva com sucesso!');
    router.back();
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.header}>Nova Transacao</Text>

      <Text style={styles.sectionTitle}>Cadastro manual</Text>

      <TextInput
        style={styles.input}
        placeholder="Descricao"
        placeholderTextColor="#999"
        value={title}
        onChangeText={setTitle}
      />

      <TextInput
        style={styles.input}
        placeholder="Valor (ex: 100.00)"
        placeholderTextColor="#999"
        value={amount}
        onChangeText={setAmount}
        keyboardType="numeric"
      />

      <View style={styles.typeContainer}>
        <TouchableOpacity
          style={[
            styles.typeButton,
            type === 'income' && styles.activeIncome,
          ]}
          onPress={() => setType('income')}
        >
          <Text style={styles.typeText}>Receita</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.typeButton,
            type === 'expense' && styles.activeExpense,
          ]}
          onPress={() => setType('expense')}
        >
          <Text style={styles.typeText}>Despesa</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.typeButton,
            type === 'deduction' && styles.activeDeduction,
          ]}
          onPress={() => setType('deduction')}
        >
          <Text style={styles.typeText}>Dedução</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
        <Text style={styles.saveText}>Salvar</Text>
      </TouchableOpacity>

      <View style={styles.divider} />

      <Text style={styles.sectionTitle}>Importar CSV ou Excel</Text>

      <TouchableOpacity
        style={styles.importButton}
        onPress={handleImportFile}
        disabled={isImporting}
      >
        <Ionicons name="document-attach-outline" size={20} color="#0c0c1b" />
        <Text style={styles.importButtonText}>
          {isImporting ? 'Processando arquivo...' : 'Selecionar arquivo'}
        </Text>
      </TouchableOpacity>

      {selectedFileName ? (
        <Text style={styles.fileName}>Arquivo: {selectedFileName}</Text>
      ) : null}

      {importedTransactions.length > 0 && (
        <View style={styles.reviewArea}>
          <View style={styles.reviewHeader}>
            <Text style={styles.sectionTitle}>Revisao da importacao</Text>
            <Text style={styles.reviewCount}>{importedTransactions.length} itens</Text>
          </View>

          {importedTransactions.map((item) => (
            <View key={item.id} style={styles.reviewItem}>
              <View style={styles.reviewItemHeader}>
                <Text style={styles.reviewItemTitle}>Transacao</Text>
                <Pressable
                  style={styles.removeButton}
                  onPress={() => removeImportedTransaction(item.id)}
                >
                  <Ionicons name="trash-outline" size={18} color="#F44336" />
                </Pressable>
              </View>

              <TextInput
                style={styles.input}
                placeholder="Descricao"
                placeholderTextColor="#999"
                value={item.title}
                onChangeText={(value) => updateImportedTransaction(item.id, 'title', value)}
              />

              <TextInput
                style={styles.input}
                placeholder="Valor"
                placeholderTextColor="#999"
                value={item.amount}
                onChangeText={(value) => updateImportedTransaction(item.id, 'amount', value)}
                keyboardType="numeric"
              />

              <View style={styles.typeContainer}>
                {(['income', 'expense', 'deduction'] as TransactionType[]).map((option) => (
                  <TouchableOpacity
                    key={option}
                    style={[
                      styles.typeButton,
                      option === 'income' && item.type === option && styles.activeIncome,
                      option === 'expense' && item.type === option && styles.activeExpense,
                      option === 'deduction' && item.type === option && styles.activeDeduction,
                    ]}
                    onPress={() => updateImportedTransaction(item.id, 'type', option)}
                  >
                    <Text style={styles.typeText}>{typeLabels[option]}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ))}

          <TouchableOpacity style={styles.confirmButton} onPress={handleConfirmImport}>
            <Text style={styles.confirmText}>Confirmar importacao</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0c0c1b',
  },
  content: {
    padding: 16,
    paddingTop: 50,
    paddingBottom: 40,
  },
  header: {
    fontSize: 24,
    color: '#fff',
    fontWeight: 'bold',
    marginBottom: 20,
    marginTop: 40,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 17,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  input: {
    backgroundColor: '#1A1A2E',
    color: '#fff',
    padding: 14,
    borderRadius: 10,
    marginBottom: 12,
  },
  typeContainer: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  typeButton: {
    flex: 1,
    padding: 14,
    borderRadius: 10,
    backgroundColor: '#2A2A3C',
    alignItems: 'center',
  },
  activeIncome: {
    backgroundColor: '#4CAF50',
  },
  activeExpense: {
    backgroundColor: '#F44336',
  },
  activeDeduction: {
    backgroundColor: '#FFC107',
  },
  typeText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 13,
  },
  saveButton: {
    backgroundColor: '#99CF1D',
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
  },
  saveText: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 16,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginVertical: 24,
  },
  importButton: {
    backgroundColor: '#99CF1D',
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  importButtonText: {
    color: '#0c0c1b',
    fontWeight: 'bold',
    fontSize: 16,
  },
  fileName: {
    color: '#b8b8c7',
    marginTop: 10,
    marginBottom: 6,
  },
  reviewArea: {
    marginTop: 20,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  reviewCount: {
    color: '#b8b8c7',
    fontSize: 13,
    marginBottom: 12,
  },
  reviewItem: {
    backgroundColor: '#111126',
    borderColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  reviewItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  reviewItemTitle: {
    color: '#b8b8c7',
    fontSize: 13,
    fontWeight: 'bold',
  },
  removeButton: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: 'rgba(244, 67, 54, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmButton: {
    backgroundColor: '#4CAF50',
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 4,
  },
  confirmText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
});