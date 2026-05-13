import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

export default function EditTransaction() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<'income' | 'expense' | 'deduction'>('expense');
  const [userId, setUserId] = useState('');

  useEffect(() => {
    loadTransaction();
  }, [id]);

  async function loadTransaction() {
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData.user) {
      Alert.alert('Erro', 'Usuario nao autenticado');
      return;
    }

    setUserId(userData.user.id);

    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('id', id)
      .eq('user_id', userData.user.id)
      .single();

    if (error) {
      console.log(error);
      Alert.alert('Erro', 'Nao foi possivel carregar a transacao');
      return;
    }

    setTitle(data.title);
    setAmount(String(data.amount));
    setType(data.type);
  }

  async function handleUpdate() {
    const parsedAmount = parseFloat(amount);

    if (!title || isNaN(parsedAmount)) {
      Alert.alert('Erro', 'Preencha os dados corretamente');
      return;
    }

    const { error } = await supabase
      .from('transactions')
      .update({
        title,
        amount: parsedAmount,
        type,
      })
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      console.log(error);
      Alert.alert('Erro', 'Nao foi possivel atualizar');
      return;
    }

    Alert.alert('Sucesso', 'Transacao atualizada');
    router.back();
  }

  async function handleDelete() {
    Alert.alert('Excluir transacao', 'Deseja realmente excluir?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase
            .from('transactions')
            .delete()
            .eq('id', id)
            .eq('user_id', userId);

          if (error) {
            console.log(error);
            Alert.alert('Erro', 'Nao foi possivel excluir');
            return;
          }

          Alert.alert('Sucesso', 'Transacao excluida');
          router.back();
        },
      },
    ]);
  }

  return (
    <View style={styles.container}>
      <Pressable
        style={styles.backButton}
        onPress={() => router.back()}
      >
        <Ionicons name="arrow-back" size={24} color="#fff" />
      </Pressable>

      <Text style={styles.header}>Editar Transacao</Text>

      <TextInput
        style={styles.input}
        placeholder="Descricao"
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
        <TouchableOpacity
          style={[styles.typeButton, type === 'income' && styles.activeIncome]}
          onPress={() => setType('income')}
        >
          <Text style={styles.typeText}>Receita</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.typeButton, type === 'expense' && styles.activeExpense]}
          onPress={() => setType('expense')}
        >
          <Text style={styles.typeText}>Despesa</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.typeButton, type === 'deduction' && styles.activeDeduction]}
          onPress={() => setType('deduction')}
        >
          <Text style={styles.typeText}>Deducao</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.saveButton} onPress={handleUpdate}>
        <Text style={styles.saveText}>Salvar alteracoes</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
        <Text style={styles.deleteText}>Excluir transacao</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    paddingTop: 50,
    backgroundColor: '#0c0c1b',
  },
  backButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    padding: 8,
    borderRadius: 8,
    marginBottom: 20,
    alignSelf: 'flex-start',
  },
  header: {
    fontSize: 24,
    color: '#fff',
    fontWeight: 'bold',
    marginBottom: 20,
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
    marginBottom: 12,
  },
  saveText: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 16,
  },
  deleteButton: {
    backgroundColor: '#3A1616',
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F44336',
  },
  deleteText: {
    color: '#F44336',
    fontWeight: 'bold',
    fontSize: 16,
  },
});
