import { createCategory, DEFAULT_CATEGORIES, getAllCategories } from '@/lib/categories';
import { classifyTransaction } from '@/lib/groq';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

export default function EditTransaction() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<'income' | 'expense' | 'deduction'>('expense');
  const [category, setCategory] = useState('Outros');
  const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES);
  const [userId, setUserId] = useState('');
  const [deleting, setDeleting] = useState(false);

  const [classifying, setClassifying] = useState(false);
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [creatingCategory, setCreatingCategory] = useState(false);

  // Ref para ter o userId mais recente dentro de callbacks sem depender do estado
  const userIdRef = useRef('');

  useEffect(() => {
    loadTransaction();
  }, [id]);

  async function loadTransaction() {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) { Alert.alert('Erro', 'Usuário não autenticado'); return; }

    setUserId(userData.user.id);
    userIdRef.current = userData.user.id;

    const cats = await getAllCategories(supabase, userData.user.id);
    setCategories(cats);

    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('id', id)
      .single();

    if (error) { Alert.alert('Erro', 'Não foi possível carregar a transação'); return; }

    setTitle(data.title);
    setAmount(String(data.amount));
    setType(data.type);
    setCategory(data.category || 'Outros');
  }

  // ─── Classificação por IA ────────────────────────────────────────────────────

  async function handleClassify() {
    if (!title) { Alert.alert('Atenção', 'Preencha a descrição antes de classificar'); return; }
    const parsedAmount = parseFloat(amount) || 0;
    setClassifying(true);
    try {
      const result = await classifyTransaction(title, parsedAmount, type, categories);
      setCategory(result);
    } catch {
      Alert.alert('Erro', 'Não foi possível classificar com IA');
    } finally {
      setClassifying(false);
    }
  }

  // ─── Criar nova categoria ────────────────────────────────────────────────────

  async function handleCreateCategory() {
    const name = newCategoryName.trim();
    if (!name) { Alert.alert('Atenção', 'Digite um nome para a categoria'); return; }
    if (categories.includes(name)) { Alert.alert('Atenção', 'Categoria já existe'); return; }
    setCreatingCategory(true);
    try {
      await createCategory(supabase, userIdRef.current, name);
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

  // ─── Atualizar ───────────────────────────────────────────────────────────────

  async function handleUpdate() {
    const parsedAmount = parseFloat(amount);
    if (!title || isNaN(parsedAmount)) { Alert.alert('Erro', 'Preencha os dados corretamente'); return; }

    const { error } = await supabase
      .from('transactions')
      .update({ title, amount: parsedAmount, type, category })
      .eq('id', id);

    if (error) { Alert.alert('Erro', 'Não foi possível atualizar'); return; }
    Alert.alert('Sucesso', 'Transação atualizada');
    router.back();
  }

  // ─── Deletar — confirmação SEPARADA da execução ──────────────────────────────

  async function executeDelete() {
    setDeleting(true);
    try {
      const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('id', id);

      if (error) {
        console.log('Erro ao excluir:', error);
        Alert.alert('Erro', 'Não foi possível excluir a transação');
        return;
      }

      // Navega de volta sem Alert para evitar conflito de navegação
      router.back();
    } catch (err) {
      console.log('Exceção ao excluir:', err);
      Alert.alert('Erro', 'Ocorreu um erro inesperado');
    } finally {
      setDeleting(false);
    }
  }

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <Pressable style={styles.backButton} onPress={() => router.back()}>
        <Ionicons name="arrow-back" size={24} color="#fff" />
      </Pressable>

      <Text style={styles.header}>Editar Transação</Text>

      <TextInput
        style={styles.input}
        placeholder="Descrição"
        placeholderTextColor="#999"
        value={title}
        onChangeText={setTitle}
      />

      <TextInput
        style={styles.input}
        placeholder="Valor"
        placeholderTextColor="#999"
        value={amount}
        onChangeText={setAmount}
        keyboardType="numeric"
      />

      <View style={styles.typeContainer}>
        {(['income', 'expense', 'deduction'] as const).map((option) => (
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
            <Text style={styles.typeText}>
              {option === 'income' ? 'Receita' : option === 'expense' ? 'Despesa' : 'Dedução'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Categoria ── */}
      <Text style={styles.label}>Categoria</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.categoryScroll}
        keyboardShouldPersistTaps="handled"
      >
        {categories.map((cat) => (
          <TouchableOpacity
            key={cat}
            style={[styles.categoryChip, category === cat && styles.categoryChipActive]}
            onPress={() => setCategory(cat)}
          >
            <Text style={[styles.categoryChipText, category === cat && styles.categoryChipTextActive]}>
              {cat}
            </Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity style={styles.addCategoryChip} onPress={() => setCategoryModalVisible(true)}>
          <Ionicons name="add" size={16} color="#99CF1D" />
          <Text style={styles.addCategoryText}>Nova</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* ── Botão IA ── */}
      <TouchableOpacity style={styles.aiButton} onPress={handleClassify} disabled={classifying}>
        {classifying ? (
          <ActivityIndicator size="small" color="#0c0c1b" />
        ) : (
          <Ionicons name="sparkles-outline" size={18} color="#0c0c1b" />
        )}
        <Text style={styles.aiButtonText}>
          {classifying ? 'Classificando...' : 'Classificar com IA'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.saveButton} onPress={handleUpdate}>
        <Text style={styles.saveText}>Salvar alterações</Text>
      </TouchableOpacity>

      {/* Botão excluir com loading state */}
      <TouchableOpacity
        style={[styles.deleteButton, deleting && styles.deleteButtonDisabled]}
        onPress={executeDelete}
        disabled={deleting}
      >
        {deleting ? (
          <ActivityIndicator size="small" color="#F44336" />
        ) : (
          <Text style={styles.deleteText}>Excluir transação</Text>
        )}
      </TouchableOpacity>

      {/* ── Modal nova categoria ── */}
      <Modal visible={categoryModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Nova categoria</Text>
            <TextInput
              style={styles.input}
              placeholder="Nome da categoria"
              placeholderTextColor="#999"
              value={newCategoryName}
              onChangeText={setNewCategoryName}
              autoFocus
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setCategoryModalVisible(false)}>
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirm}
                onPress={handleCreateCategory}
                disabled={creatingCategory}
              >
                {creatingCategory ? (
                  <ActivityIndicator size="small" color="#000" />
                ) : (
                  <Text style={styles.modalConfirmText}>Criar</Text>
                )}
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
  content: { padding: 16, paddingTop: 50, paddingBottom: 40 },
  backButton: {
    backgroundColor: 'rgba(255,255,255,0.2)', padding: 8, borderRadius: 8,
    marginBottom: 20, alignSelf: 'flex-start',
  },
  header: { fontSize: 24, color: '#fff', fontWeight: 'bold', marginBottom: 20 },
  label: { color: '#b8b8c7', fontSize: 13, marginBottom: 8, marginTop: 4 },
  input: { backgroundColor: '#1A1A2E', color: '#fff', padding: 14, borderRadius: 10, marginBottom: 12 },
  typeContainer: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  typeButton: { flex: 1, padding: 14, borderRadius: 10, backgroundColor: '#2A2A3C', alignItems: 'center' },
  activeIncome: { backgroundColor: '#4CAF50' },
  activeExpense: { backgroundColor: '#F44336' },
  activeDeduction: { backgroundColor: '#FFC107' },
  typeText: { color: '#fff', fontWeight: 'bold', fontSize: 13 },
  categoryScroll: { marginBottom: 12 },
  categoryChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: '#1A1A2E', marginRight: 8, borderWidth: 1, borderColor: '#2A2A3C',
  },
  categoryChipActive: { backgroundColor: '#1e3a0f', borderColor: '#99CF1D' },
  categoryChipText: { color: '#b8b8c7', fontSize: 13 },
  categoryChipTextActive: { color: '#99CF1D', fontWeight: 'bold' },
  addCategoryChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: '#1A1A2E', borderWidth: 1, borderColor: '#99CF1D', marginRight: 8,
  },
  addCategoryText: { color: '#99CF1D', fontSize: 13 },
  aiButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#99CF1D', padding: 14, borderRadius: 10, marginBottom: 12,
  },
  aiButtonText: { color: '#0c0c1b', fontWeight: 'bold', fontSize: 15 },
  saveButton: {
    backgroundColor: '#99CF1D', padding: 16, borderRadius: 10,
    alignItems: 'center', marginBottom: 12,
  },
  saveText: { color: '#000', fontWeight: 'bold', fontSize: 16 },
  deleteButton: {
    backgroundColor: '#3A1616', padding: 16, borderRadius: 10,
    alignItems: 'center', borderWidth: 1, borderColor: '#F44336',
  },
  deleteButtonDisabled: {
    opacity: 0.5,
  },
  deleteText: { color: '#F44336', fontWeight: 'bold', fontSize: 16 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 24 },
  modalCard: { backgroundColor: '#1A1A2E', borderRadius: 16, padding: 20 },
  modalTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 16 },
  modalButtons: { flexDirection: 'row', gap: 12, marginTop: 4 },
  modalCancel: {
    flex: 1, padding: 14, borderRadius: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', alignItems: 'center',
  },
  modalCancelText: { color: '#b8b8c7', fontWeight: 'bold' },
  modalConfirm: { flex: 1, padding: 14, borderRadius: 10, backgroundColor: '#99CF1D', alignItems: 'center' },
  modalConfirmText: { color: '#000', fontWeight: 'bold' },
});