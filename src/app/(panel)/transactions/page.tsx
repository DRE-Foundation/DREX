import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  Alert,
  FlatList,
  GestureResponderEvent,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

type Transaction = {
  id: string;
  title: string;
  amount: number;
  type: 'income' | 'expense' | 'deduction';
  category: string;
};

export default function TransactionsPage() {
  const router = useRouter();
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  async function fetchTransactions() {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) { console.log(userError); return; }

    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', userData.user.id)
      .order('created_at', { ascending: false });

    if (error) { console.log(error); return; }
    setTransactions(data || []);
  }

  async function deleteTransaction(id: string) {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      Alert.alert('Erro', 'Usuário não autenticado');
      return;
    }

    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('id', id)
      .eq('user_id', userData.user.id);

    if (error) {
      console.log('Erro ao deletar:', error);
      Alert.alert('Erro', 'Não foi possível excluir');
      return;
    }

    setTransactions((current) => current.filter((item) => item.id !== id));
    Alert.alert('Sucesso', 'Transação excluída');
  }

  function handleDelete(item: Transaction, e: GestureResponderEvent) {
    // Impede que o toque propague para o TouchableOpacity pai (que abre edição)
    e.stopPropagation();

    Alert.alert('Excluir transação', `Deseja excluir "${item.title}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir', style: 'destructive', onPress: () => deleteTransaction(item.id) },
    ]);
  }

  useFocusEffect(useCallback(() => { fetchTransactions(); }, []));

  function getAmountStyle(type: Transaction['type']) {
    if (type === 'income') return styles.income;
    if (type === 'deduction') return styles.deduction;
    return styles.expense;
  }

  function getAmountPrefix(type: Transaction['type']) {
    if (type === 'income') return '+';
    if (type === 'deduction') return '!';
    return '-';
  }

  function getTypeLabel(type: Transaction['type']) {
    if (type === 'income') return 'Receita';
    if (type === 'deduction') return 'Dedução';
    return 'Despesa';
  }

  function renderItem({ item }: { item: Transaction }) {
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => router.push(`/(panel)/transactions/edit?id=${item.id}`)}
        activeOpacity={0.8}
      >
        <View style={styles.cardTop}>
          <View style={styles.titleGroup}>
            <Text style={styles.title}>{item.title}</Text>
            <View style={styles.badgeRow}>
              <View style={styles.typeBadge}>
                <Text style={styles.typeBadgeText}>{getTypeLabel(item.type)}</Text>
              </View>
              {item.category ? (
                <View style={styles.categoryBadge}>
                  <Text style={styles.categoryBadgeText}>{item.category}</Text>
                </View>
              ) : null}
            </View>
          </View>

          {/* TouchableOpacity separado com onPress recebendo o evento */}
          
        </View>

        <Text style={[styles.amount, getAmountStyle(item.type)]}>
          {getAmountPrefix(item.type)} R$ {Number(item.amount).toFixed(2)}
        </Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Transações</Text>

      <FlatList
        data={transactions}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={{ paddingBottom: 100 }}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="receipt-outline" size={48} color="#2A2A3C" />
            <Text style={styles.emptyText}>Nenhuma transação ainda</Text>
            <Text style={styles.emptySubText}>Toque em + para adicionar</Text>
          </View>
        }
      />

      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/(panel)/transactions/new')}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 50, backgroundColor: '#0c0c1b' },
  header: {
    paddingHorizontal: 16,
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
    marginTop: 40,
  },
  card: {
    backgroundColor: '#1A1A2E',
    padding: 16,
    borderRadius: 10,
    marginBottom: 12,
    marginHorizontal: 16,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  titleGroup: { flex: 1, paddingRight: 12 },
  title: { color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 6 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  typeBadge: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  typeBadgeText: { color: '#b8b8c7', fontSize: 11 },
  categoryBadge: {
    backgroundColor: 'rgba(153,207,29,0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(153,207,29,0.3)',
  },
  categoryBadgeText: { color: '#99CF1D', fontSize: 11, fontWeight: '600' },
  deleteButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: 'rgba(244,67,54,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  amount: { fontSize: 18, fontWeight: 'bold' },
  income: { color: '#4CAF50' },
  expense: { color: '#F44336' },
  deduction: { color: '#FFC107' },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    backgroundColor: '#4CAF50',
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabText: { fontSize: 28, color: '#fff', fontWeight: 'bold' },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
  },
  emptyText: { color: '#b8b8c7', fontSize: 16, marginTop: 16 },
  emptySubText: { color: '#444', fontSize: 13, marginTop: 4 },
});