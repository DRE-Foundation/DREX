import { createCategory, DEFAULT_CATEGORIES, getAllCategories } from '@/lib/categories';
import { getRowsFromPickedFile, readAssetAsBase64 } from '@/lib/fileReader';
import { classifyTransaction } from '@/lib/groq';
import { supabase } from '@/lib/supabase';
import {
  csvToRows,
  ImportedTransaction,
  parseAmountValue,
  rowsToTransactions,
} from '@/lib/transactionParser';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

type TransactionType = 'income' | 'expense' | 'deduction';

interface ImportedTransactionWithCategory extends ImportedTransaction {
  category: string;
}

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

const typeColors: Record<TransactionType, string> = {
  income: '#4CAF50',
  expense: '#F44336',
  deduction: '#FFC107',
};

export default function NewTransaction() {
  const router = useRouter();

  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<TransactionType>('expense');
  const [category, setCategory] = useState('Outros');
  const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES);
  const [userId, setUserId] = useState('');

  const [classifying, setClassifying] = useState(false);

  const [categoryModalVisible, setCategoryModalVisible] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [creatingCategory, setCreatingCategory] = useState(false);

  const [importedTransactions, setImportedTransactions] = useState<
    ImportedTransactionWithCategory[]
  >([]);

  const [selectedFileName, setSelectedFileName] = useState('');
  const [isImporting, setIsImporting] = useState(false);

  const [classifyingAll, setClassifyingAll] = useState(false);
  const [classifyProgress, setClassifyProgress] = useState(0);

  const importedRef = useRef<ImportedTransactionWithCategory[]>([]);

  useEffect(() => {
    importedRef.current = importedTransactions;
  }, [importedTransactions]);

  useEffect(() => {
    loadUserAndCategories();
  }, []);

  async function loadUserAndCategories() {
    const { data } = await supabase.auth.getUser();

    if (!data.user) return;

    setUserId(data.user.id);

    const cats = await getAllCategories(supabase, data.user.id);

    setCategories(cats);
  }

  async function handleClassify() {
    if (!title) {
      Alert.alert('Atenção', 'Preencha a descrição antes de classificar');
      return;
    }

    setClassifying(true);

    try {
      const result = await classifyTransaction(
        title,
        parseFloat(amount) || 0,
        type,
        categories
      );

      setCategory(result);
    } catch {
      Alert.alert('Erro', 'Não foi possível classificar com IA');
    } finally {
      setClassifying(false);
    }
  }

  async function runClassifyAll() {
    const snapshot = [...importedRef.current];

    const total = snapshot.length;

    if (!total) return;

    setClassifyingAll(true);
    setClassifyProgress(0);

    const results = [...snapshot];

    const chunkSize = 3;

    let done = 0;

    for (let i = 0; i < total; i += chunkSize) {
      await Promise.all(
        results.slice(i, i + chunkSize).map(async (item, idx) => {
          try {
            const cat = await classifyTransaction(
              item.title,
              parseAmountValue(item.amount),
              item.type,
              categories
            );

            results[i + idx] = {
              ...results[i + idx],
              category: cat,
            };
          } catch {}

          done++;

          setClassifyProgress(Math.round((done / total) * 100));
        })
      );
    }

    setImportedTransactions(results);

    setClassifyingAll(false);
    setClassifyProgress(0);

    Alert.alert('Concluído', `${total} transações classificadas!`);
  }

  async function handleClassifyAll() {
    const current = importedRef.current;

    if (!current.length) return;

    if (Platform.OS === 'web') {
      const confirmed = window.confirm(
        `Classificar ${current.length} transações automaticamente?`
      );

      if (confirmed) {
        await runClassifyAll();
      }

      return;
    }

    Alert.alert(
      'Classificar tudo com IA',
      `Classificar ${current.length} transações automaticamente?`,
      [
        {
          text: 'Cancelar',
          style: 'cancel',
        },
        {
          text: 'Classificar tudo',
          onPress: () => runClassifyAll(),
        },
      ]
    );
  }

  function handleClearAll() {
    const clearData = () => {
      setImportedTransactions([]);
      setSelectedFileName('');
      setTitle('');
      setAmount('');
      setType('expense');
      setCategory('Outros');
    };

    if (Platform.OS === 'web') {
      const confirmed = window.confirm(
        'Remove todos os itens importados e limpa o formulário. Confirmar?'
      );

      if (confirmed) {
        clearData();
      }

      return;
    }

    Alert.alert(
      'Limpar tudo',
      'Remove todos os itens importados e limpa o formulário. Confirmar?',
      [
        {
          text: 'Cancelar',
          style: 'cancel',
        },
        {
          text: 'Limpar tudo',
          style: 'destructive',
          onPress: clearData,
        },
      ]
    );
  }

  async function handleCreateCategory() {
    const name = newCategoryName.trim();

    if (!name) {
      Alert.alert('Atenção', 'Digite um nome');
      return;
    }

    if (categories.includes(name)) {
      Alert.alert('Atenção', 'Categoria já existe');
      return;
    }

    setCreatingCategory(true);

    try {
      await createCategory(supabase, userId, name);

      const updated = [...categories, name];

      setCategories(updated);
      setCategory(name);

      setNewCategoryName('');
      setCategoryModalVisible(false);
    } catch {
      Alert.alert('Erro', 'Não foi possível criar a categoria');
    } finally {
      setCreatingCategory(false);
    }
  }

  async function handleImportFile() {
    try {
      if (Platform.OS !== 'web') {
        const ok = await new Promise<boolean>((resolve) =>
          Alert.alert(
            'Acesso aos arquivos',
            'O app vai abrir o seletor de arquivos.',
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
          )
        );

        if (!ok) return;
      }

      const result = await DocumentPicker.getDocumentAsync({
        type: FILE_TYPES,
        copyToCacheDirectory: true,
        multiple: false,
        base64: true,
      });

      if (result.canceled) return;

      setIsImporting(true);

      const file = result.assets[0];

      const fileName = file.name || 'arquivo importado';

      const extension = fileName.split('.').pop()?.toLowerCase();

      const isCsv =
        extension === 'csv' || Boolean(file.mimeType?.includes('csv'));

      const isPdf =
        extension === 'pdf' || file.mimeType === 'application/pdf';

      if (!['csv', 'xls', 'xlsx', 'pdf'].includes(extension || '')) {
        Alert.alert(
          'Formato não suportado',
          'Selecione CSV, XLS, XLSX ou PDF'
        );

        return;
      }

      let transactions: ImportedTransaction[];

      if (isPdf) {
        const fileBase64 = await readAssetAsBase64(file);

        const { data, error } = await supabase.functions.invoke(
          'import-pdf-transactions',
          {
            body: {
              fileName: file.name,
              fileBase64,
            },
          }
        );

        if (error) {
          throw new Error(error.message);
        }

        // Suporta tanto { transactions: [...] } quanto [...] direto
        const rawTransactions = Array.isArray(data?.transactions)
          ? data.transactions
          : Array.isArray(data)
          ? data
          : null;

        if (!rawTransactions) {
          console.log('Resposta inesperada da função PDF:', JSON.stringify(data));
          throw new Error('Resposta inválida da função de importação de PDF');
        }

        transactions = rowsToTransactions(rawTransactions);
      } else {
        const rows = await getRowsFromPickedFile(
          file,
          isCsv,
          csvToRows
        );

        transactions = rowsToTransactions(rows);
      }

      if (!transactions.length) {
        Alert.alert(
          'Arquivo lido',
          isPdf
            ? 'Nenhuma transação encontrada. Se o PDF for uma imagem escaneada, pode ser necessário OCR.'
            : 'Nenhuma transação encontrada.'
        );

        return;
      }

      setSelectedFileName(fileName);

      setImportedTransactions(
        transactions.map((t) => ({
          ...t,
          category: 'Outros',
        }))
      );

      Alert.alert(
        'Arquivo lido',
        `${transactions.length} transações prontas.`
      );
    } catch (error) {
      console.log(error);

      Alert.alert(
        'Erro',
        error instanceof Error ? error.message : String(error)
      );
    } finally {
      setIsImporting(false);
    }
  }

  function updateItem(
    id: string,
    field: keyof ImportedTransactionWithCategory,
    value: string
  ) {
    setImportedTransactions((cur) =>
      cur.map((item) =>
        item.id === id
          ? {
              ...item,
              [field]: value,
            }
          : item
      )
    );
  }

  function removeItem(id: string) {
    setImportedTransactions((cur) =>
      cur.filter((item) => item.id !== id)
    );
  }

  async function handleConfirmImport() {
    const valid = importedTransactions
      .map((item) => ({
        ...item,
        parsedAmount: parseAmountValue(item.amount),
      }))
      .filter(
        (item) =>
          item.title.trim() &&
          !isNaN(item.parsedAmount)
      );

    if (!valid.length) {
      Alert.alert(
        'Erro',
        'Revise as transações antes de confirmar'
      );

      return;
    }

    const { data, error: userError } =
      await supabase.auth.getUser();

    if (userError || !data.user) {
      Alert.alert('Erro', 'Usuário não autenticado');
      return;
    }

    const { error } = await supabase
      .from('transactions')
      .insert(
        valid.map((item) => ({
          title: item.title.trim(),
          amount: Math.abs(item.parsedAmount),
          type: item.type,
          category: item.category || 'Outros',
          user_id: data.user.id,
        }))
      );

    if (error) {
      Alert.alert(
        'Erro',
        'Não foi possível salvar'
      );

      return;
    }

    Alert.alert(
      'Sucesso',
      `${valid.length} transações importadas!`
    );

    router.back();
  }

  async function handleSave() {
    if (!title || !amount) {
      Alert.alert(
        'Erro',
        'Preencha todos os campos'
      );

      return;
    }

    const parsedAmount = parseFloat(amount);

    if (isNaN(parsedAmount)) {
      Alert.alert('Erro', 'Valor inválido');
      return;
    }

    const { data, error: userError } =
      await supabase.auth.getUser();

    if (userError || !data.user) {
      Alert.alert(
        'Erro',
        'Usuário não autenticado'
      );

      return;
    }

    const { error } = await supabase
      .from('transactions')
      .insert([
        {
          title,
          amount: parsedAmount,
          type,
          category,
          user_id: data.user.id,
        },
      ]);

    if (error) {
      Alert.alert('Erro ao salvar');
      return;
    }

    Alert.alert(
      'Sucesso',
      'Transação salva!'
    );

    router.back();
  }


  const hasImported = importedTransactions.length > 0;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

      {/* ══ HEADER ══ */}
      <View style={styles.headerRow}>
        <Text style={styles.header}>Nova Transacao</Text>
        {hasImported && (
          <TouchableOpacity style={styles.clearAllBtn} onPress={handleClearAll}>
            <Ionicons name="trash-outline" size={14} color="#F44336" />
            <Text style={styles.clearAllText}>Limpar tudo</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ══ FORMULÁRIO MANUAL ══ */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Cadastro manual</Text>

        <TextInput style={styles.input} placeholder="Descrição" placeholderTextColor="#555"
          value={title} onChangeText={setTitle} />

        <TextInput style={styles.input} placeholder="Valor (ex: 100.00)" placeholderTextColor="#555"
          value={amount} onChangeText={setAmount} keyboardType="numeric" />

        <View style={styles.typeRow}>
          {(['income', 'expense', 'deduction'] as TransactionType[]).map((option) => (
            <TouchableOpacity key={option}
              style={[styles.typeChip, type === option && { backgroundColor: typeColors[option] }]}
              onPress={() => setType(option)}>
              <Text style={[styles.typeChipText, type === option && { color: '#fff' }]}>{typeLabels[option]}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.fieldLabel}>Categoria</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
          {categories.map((cat) => (
            <TouchableOpacity key={cat} style={[styles.catChip, category === cat && styles.catChipActive]}
              onPress={() => setCategory(cat)}>
              <Text style={[styles.catChipText, category === cat && styles.catChipTextActive]}>{cat}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={styles.addCatChip} onPress={() => setCategoryModalVisible(true)}>
            <Ionicons name="add" size={14} color="#99CF1D" />
            <Text style={styles.addCatText}>Nova</Text>
          </TouchableOpacity>
        </ScrollView>

        <TouchableOpacity style={styles.aiBtn} onPress={handleClassify} disabled={classifying}>
          {classifying ? <ActivityIndicator size="small" color="#0c0c1b" /> : <Ionicons name="sparkles-outline" size={16} color="#0c0c1b" />}
          <Text style={styles.aiBtnText}>{classifying ? 'Classificando...' : 'Classificar com IA'}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
          <Text style={styles.saveBtnText}>Salvar transação</Text>
        </TouchableOpacity>
      </View>

      {/* ══ DIVISOR ══ */}
      <View style={styles.divider}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>ou importe um arquivo</Text>
        <View style={styles.dividerLine} />
      </View>

      {/* ══ BOTÃO IMPORTAR ══ */}
      <TouchableOpacity style={styles.importBtn} onPress={handleImportFile} disabled={isImporting}>
        <Ionicons name="document-attach-outline" size={20} color="#0c0c1b" />
        <Text style={styles.importBtnText}>
          {isImporting ? 'Processando...' : selectedFileName ? 'Trocar arquivo' : 'Selecionar arquivo'}
        </Text>
      </TouchableOpacity>

      {selectedFileName ? (
        <View style={styles.fileInfo}>
          <Ionicons name="document-outline" size={13} color="#99CF1D" />
          <Text style={styles.fileInfoText} numberOfLines={1}>{selectedFileName}</Text>
        </View>
      ) : null}

      {/* ══ LISTA IMPORTADA ══ */}
      {hasImported && (
        <View style={styles.reviewSection}>

          {/* Barra de ações em lote */}
          <View style={styles.batchBar}>
            <View>
              <Text style={styles.batchTitle}>Revisão da importação</Text>
              <Text style={styles.batchCount}>{importedTransactions.length} transações</Text>
            </View>
            <TouchableOpacity
              style={[styles.batchAiBtn, classifyingAll && { opacity: 0.7 }]}
              onPress={handleClassifyAll}
              disabled={classifyingAll}
            >
              {classifyingAll
                ? <ActivityIndicator size="small" color="#0c0c1b" />
                : <Ionicons name="sparkles-outline" size={14} color="#0c0c1b" />}
              <Text style={styles.batchAiBtnText}>
                {classifyingAll ? `Classificando ${classifyProgress}%` : 'Classificar tudo'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Barra de progresso */}
          {classifyingAll && (
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${classifyProgress}%` as any }]} />
            </View>
          )}

          {/* Cards compactos */}
          {importedTransactions.map((item, index) => (
            <View key={item.id} style={styles.reviewCard}>
              {/* Linha 1: número + título + remover */}
              <View style={styles.reviewCardHeader}>
                <View style={styles.reviewIndex}>
                  <Text style={styles.reviewIndexText}>{index + 1}</Text>
                </View>
                <TextInput
                  style={styles.reviewTitleInput}
                  placeholder="Descrição"
                  placeholderTextColor="#555"
                  value={item.title}
                  onChangeText={(v) => updateItem(item.id, 'title', v)}
                />
                <Pressable style={styles.removeBtn} onPress={() => removeItem(item.id)}>
                  <Ionicons name="close" size={15} color="#F44336" />
                </Pressable>
              </View>

              {/* Linha 2: valor + tipo */}
              <View style={styles.reviewRow}>
                <TextInput
                  style={[styles.input, { flex: 1, marginBottom: 0 }]}
                  placeholder="Valor"
                  placeholderTextColor="#555"
                  value={item.amount}
                  onChangeText={(v) => updateItem(item.id, 'amount', v)}
                  keyboardType="numeric"
                />
                <View style={styles.reviewTypeRow}>
                  {(['income', 'expense', 'deduction'] as TransactionType[]).map((option) => (
                    <TouchableOpacity
                      key={option}
                      style={[styles.reviewTypeChip, item.type === option && { backgroundColor: typeColors[option] }]}
                      onPress={() => updateItem(item.id, 'type', option)}
                    >
                      <Text style={[styles.reviewTypeText, item.type === option && { color: '#fff' }]}>
                        {option === 'income' ? 'R' : option === 'expense' ? 'D' : 'Ded'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Linha 3: categoria */}
              <View style={styles.reviewCatRow}>
                <Ionicons name="pricetag-outline" size={11} color="#99CF1D" />
                <Text style={styles.reviewCatText}>{item.category || 'Outros'}</Text>
              </View>
            </View>
          ))}

          {/* Confirmar */}
          <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirmImport}>
            <Ionicons name="checkmark-circle-outline" size={19} color="#fff" />
            <Text style={styles.confirmBtnText}>Confirmar importação ({importedTransactions.length})</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ══ MODAL NOVA CATEGORIA ══ */}
      <Modal visible={categoryModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Nova categoria</Text>
            <TextInput style={styles.input} placeholder="Nome da categoria" placeholderTextColor="#555"
              value={newCategoryName} onChangeText={setNewCategoryName} autoFocus />
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setCategoryModalVisible(false)}>
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirmBtn} onPress={handleCreateCategory} disabled={creatingCategory}>
                {creatingCategory ? <ActivityIndicator size="small" color="#000" /> : <Text style={styles.modalConfirmText}>Criar</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0c0c1b' },
  content: { padding: 16, paddingTop: 60, paddingBottom: 48 },

  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  header: { fontSize: 26, color: '#fff', fontWeight: 'bold' },
  clearAllBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(244,67,54,0.1)', paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 20, borderWidth: 1, borderColor: 'rgba(244,67,54,0.25)',
  },
  clearAllText: { color: '#F44336', fontSize: 12, fontWeight: 'bold' },

  card: { backgroundColor: '#111126', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  cardTitle: { color: '#555', fontSize: 11, fontWeight: 'bold', letterSpacing: 1.2, marginBottom: 14, textTransform: 'uppercase' },

  input: { backgroundColor: '#1A1A2E', color: '#fff', padding: 13, borderRadius: 10, marginBottom: 10, fontSize: 14 },
  fieldLabel: { color: '#b8b8c7', fontSize: 12, marginBottom: 8, marginTop: 2 },

  typeRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  typeChip: { flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: '#1A1A2E', alignItems: 'center' },
  typeChipText: { color: '#444', fontWeight: 'bold', fontSize: 13 },

  chipScroll: { marginBottom: 14 },
  catChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: '#1A1A2E', marginRight: 8, borderWidth: 1, borderColor: 'transparent' },
  catChipActive: { borderColor: '#99CF1D', backgroundColor: 'rgba(153,207,29,0.1)' },
  catChipText: { color: '#555', fontSize: 12 },
  catChipTextActive: { color: '#99CF1D', fontWeight: 'bold' },
  addCatChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: '#1A1A2E', borderWidth: 1, borderColor: '#99CF1D', marginRight: 8 },
  addCatText: { color: '#99CF1D', fontSize: 12 },

  aiBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: '#99CF1D', padding: 13, borderRadius: 10, marginBottom: 10 },
  aiBtnText: { color: '#0c0c1b', fontWeight: 'bold', fontSize: 14 },
  saveBtn: { backgroundColor: '#1A1A2E', padding: 13, borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  saveBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },

  divider: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 24 },
  dividerLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.06)' },
  dividerText: { color: '#444', fontSize: 12 },

  importBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#99CF1D', padding: 15, borderRadius: 12 },
  importBtnText: { color: '#0c0c1b', fontWeight: 'bold', fontSize: 15 },
  fileInfo: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, backgroundColor: 'rgba(153,207,29,0.07)', padding: 10, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(153,207,29,0.15)' },
  fileInfoText: { color: '#99CF1D', fontSize: 12, flex: 1 },

  reviewSection: { marginTop: 24 },

  batchBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#111126', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', marginBottom: 4 },
  batchTitle: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  batchCount: { color: '#555', fontSize: 12, marginTop: 2 },
  batchAiBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#99CF1D', paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10, minWidth: 140, justifyContent: 'center' },
  batchAiBtnText: { color: '#0c0c1b', fontWeight: 'bold', fontSize: 13 },

  progressTrack: { height: 3, backgroundColor: '#1A1A2E', borderRadius: 2, marginTop: 8, marginBottom: 4, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#99CF1D', borderRadius: 2 },

  reviewCard: { backgroundColor: '#111126', borderRadius: 12, padding: 12, marginTop: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  reviewCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  reviewIndex: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#1A1A2E', alignItems: 'center', justifyContent: 'center' },
  reviewIndexText: { color: '#444', fontSize: 10, fontWeight: 'bold' },
  reviewTitleInput: { flex: 1, backgroundColor: '#1A1A2E', color: '#fff', padding: 8, borderRadius: 8, fontSize: 13 },
  removeBtn: { width: 28, height: 28, borderRadius: 8, backgroundColor: 'rgba(244,67,54,0.1)', alignItems: 'center', justifyContent: 'center' },

  reviewRow: { flexDirection: 'row', gap: 8, marginBottom: 8, alignItems: 'center' },
  reviewTypeRow: { flexDirection: 'row', gap: 4 },
  reviewTypeChip: { paddingHorizontal: 9, paddingVertical: 9, borderRadius: 8, backgroundColor: '#1A1A2E', alignItems: 'center', justifyContent: 'center' },
  reviewTypeText: { color: '#444', fontWeight: 'bold', fontSize: 11 },

  reviewCatRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  reviewCatText: { color: '#99CF1D', fontSize: 11 },

  confirmBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#4CAF50', padding: 16, borderRadius: 12, marginTop: 14 },
  confirmBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', padding: 24 },
  modalCard: { backgroundColor: '#111126', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  modalTitle: { color: '#fff', fontSize: 17, fontWeight: 'bold', marginBottom: 16 },
  modalBtns: { flexDirection: 'row', gap: 10, marginTop: 4 },
  modalCancelBtn: { flex: 1, padding: 13, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', alignItems: 'center' },
  modalCancelText: { color: '#b8b8c7', fontWeight: 'bold' },
  modalConfirmBtn: { flex: 1, padding: 13, borderRadius: 10, backgroundColor: '#99CF1D', alignItems: 'center' },
  modalConfirmText: { color: '#000', fontWeight: 'bold' },
});