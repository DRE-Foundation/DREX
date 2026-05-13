import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { getRowsFromPickedFile, readAssetAsBase64 } from '@/lib/fileReader';
import { csvToRows, ImportedTransaction, parseAmountValue, rowsToTransactions } from '@/lib/transactionParser';

type TransactionType = 'income' | 'expense' | 'deduction';

const FILE_TYPES = [
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

  // ─── Confirmação de acesso ────────────────────────────────────────────────────

  function requestFileAccessConfirmation() {
    if (Platform.OS === 'web') return Promise.resolve(true);

    return new Promise<boolean>((resolve) => {
      Alert.alert(
        'Acesso aos arquivos',
        'Para importar CSV, Excel ou PDF, permita que o app abra o seletor de arquivos do telefone.',
        [
          { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
          { text: 'Continuar', onPress: () => resolve(true) },
        ]
      );
    });
  }

  // ─── Importar arquivo ─────────────────────────────────────────────────────────

  async function handleImportFile() {
    try {
      const canOpenFiles = await requestFileAccessConfirmation();
      if (!canOpenFiles) return;

      const result = await DocumentPicker.getDocumentAsync({
        type: FILE_TYPES,
        copyToCacheDirectory: true,
        multiple: false,
        ...(Platform.OS !== 'web' && { base64: true }),
      });

      if (result.canceled) return;

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

      let transactions: ImportedTransaction[];

      if (isPdf) {
        const fileBase64 = await readAssetAsBase64(file);
        const { data, error } = await supabase.functions.invoke('import-pdf-transactions', {
          body: { fileName: file.name, fileBase64 },
        });

        if (error) throw new Error(`import-pdf-transactions retornou erro: ${error.message}`);
        if (!Array.isArray(data?.transactions)) throw new Error('Resposta invalida do servidor.');

        transactions = rowsToTransactions(data.transactions);
      } else {
        const rows = await getRowsFromPickedFile(file, isCsv, csvToRows);
        transactions = rowsToTransactions(rows);
      }

      if (!transactions.length) {
        Alert.alert(
          'Arquivo lido',
          isPdf
            ? 'Nenhuma transacao encontrada. Se o PDF for escaneado, sera necessario OCR.'
            : 'Nenhuma transacao encontrada para revisar.'
        );
        return;
      }

      setSelectedFileName(fileName);
      setImportedTransactions(transactions);
      Alert.alert('Arquivo lido', `${transactions.length} transacoes encontradas para revisao`);
    } catch (error) {
      Alert.alert('Erro', `Nao foi possivel importar o arquivo. Detalhe: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsImporting(false);
    }
  }

  // ─── Edição dos itens importados ──────────────────────────────────────────────

  function updateImportedTransaction(id: string, field: keyof Omit<ImportedTransaction, 'id'>, value: string) {
    setImportedTransactions((current) =>
      current.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  }

  function removeImportedTransaction(id: string) {
    setImportedTransactions((current) => current.filter((item) => item.id !== id));
  }

  // ─── Confirmar importação ─────────────────────────────────────────────────────

  async function handleConfirmImport() {
    const validTransactions = importedTransactions
      .map((item) => ({ ...item, parsedAmount: parseAmountValue(item.amount) }))
      .filter((item) => item.title.trim() && !isNaN(item.parsedAmount));

    if (!validTransactions.length) {
      Alert.alert('Erro', 'Revise as transacoes antes de confirmar');
      return;
    }

    const { data, error: userError } = await supabase.auth.getUser();
    if (userError || !data.user) { Alert.alert('Erro', 'Usuario nao autenticado'); return; }

    const { error } = await supabase.from('transactions').insert(
      validTransactions.map((item) => ({
        title: item.title.trim(),
        amount: Math.abs(item.parsedAmount),
        type: item.type,
        user_id: data.user.id,
      }))
    );

    if (error) { console.log(error); Alert.alert('Erro', 'Nao foi possivel salvar a importacao'); return; }

    Alert.alert('Sucesso', 'Transacoes importadas com sucesso!');
    router.back();
  }

  // ─── Salvar manual ────────────────────────────────────────────────────────────

  async function handleSave() {
    if (!title || !amount) { Alert.alert('Erro', 'Preencha todos os campos'); return; }

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount)) { Alert.alert('Erro', 'Valor invalido'); return; }

    const { data, error: userError } = await supabase.auth.getUser();
    if (userError || !data.user) { Alert.alert('Erro', 'Usuario nao autenticado'); return; }

    const { error } = await supabase.from('transactions').insert([{
      title,
      amount: parsedAmount,
      type,
      user_id: data.user.id,
    }]);

    if (error) { console.log(error); Alert.alert('Erro ao salvar'); return; }

    Alert.alert('Sucesso', 'Transacao salva com sucesso!');
    router.back();
  }

  // ─── Render ───────────────────────────────────────────────────────────────────

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
        {(['income', 'expense', 'deduction'] as TransactionType[]).map((option) => (
          <TouchableOpacity
            key={option}
            style={[
              styles.typeButton,
              option === 'income' && type === option && styles.activeIncome,
              option === 'expense' && type === option && styles.activeExpense,
              option === 'deduction' && type === option && styles.activeDeduction,
            ]}
            onPress={() => setType(option)}
          >
            <Text style={styles.typeText}>{typeLabels[option]}</Text>
          </TouchableOpacity>
        ))}
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
                <Pressable style={styles.removeButton} onPress={() => removeImportedTransaction(item.id)}>
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
  container: { flex: 1, backgroundColor: '#0c0c1b' },
  content: { padding: 16, paddingTop: 50, paddingBottom: 40 },
  header: { fontSize: 24, color: '#fff', fontWeight: 'bold', marginBottom: 20, marginTop: 40 },
  sectionTitle: { color: '#fff', fontSize: 17, fontWeight: 'bold', marginBottom: 12 },
  input: { backgroundColor: '#1A1A2E', color: '#fff', padding: 14, borderRadius: 10, marginBottom: 12 },
  typeContainer: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  typeButton: { flex: 1, padding: 14, borderRadius: 10, backgroundColor: '#2A2A3C', alignItems: 'center' },
  activeIncome: { backgroundColor: '#4CAF50' },
  activeExpense: { backgroundColor: '#F44336' },
  activeDeduction: { backgroundColor: '#FFC107' },
  typeText: { color: '#fff', fontWeight: 'bold', fontSize: 13 },
  saveButton: { backgroundColor: '#99CF1D', padding: 16, borderRadius: 10, alignItems: 'center' },
  saveText: { color: '#000', fontWeight: 'bold', fontSize: 16 },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginVertical: 24 },
  importButton: { backgroundColor: '#99CF1D', padding: 16, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  importButtonText: { color: '#0c0c1b', fontWeight: 'bold', fontSize: 16 },
  fileName: { color: '#b8b8c7', marginTop: 10, marginBottom: 6 },
  reviewArea: { marginTop: 20 },
  reviewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  reviewCount: { color: '#b8b8c7', fontSize: 13, marginBottom: 12 },
  reviewItem: { backgroundColor: '#111126', borderColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 12 },
  reviewItemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  reviewItemTitle: { color: '#b8b8c7', fontSize: 13, fontWeight: 'bold' },
  removeButton: { width: 34, height: 34, borderRadius: 8, backgroundColor: 'rgba(244, 67, 54, 0.1)', alignItems: 'center', justifyContent: 'center' },
  confirmButton: { backgroundColor: '#4CAF50', padding: 16, borderRadius: 10, alignItems: 'center', marginTop: 4 },
  confirmText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
});