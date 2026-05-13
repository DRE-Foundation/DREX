
// A pagina de dashboard apresenta um resumo financeiro do usuario, 
// mostrando o lucro ou prejuizo do periodo, as entradas e saidas, e um comparativo entre ambos. 
// O usuario pode  tambem gerar uma demonstracao do resultado do exercicio (DRE) para analisar a performance financeira de forma mais detalhada. A interface utiliza cores e graficos para facilitar a visualizacao dos dados.  

import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

type Transaction = {
  amount: number;
  type: 'income' | 'expense' | 'deduction';
};

type DreData = {
  grossRevenue: number;
  deductions: number;
  netRevenue: number;
  operationalExpenses: number;
  result: number;
};

export default function Dashboard() {
  const [income, setIncome] = useState(0);
  const [expense, setExpense] = useState(0);
  const [balance, setBalance] = useState(0);
  const [userName, setUserName] = useState('Usuario');
  const [showDre, setShowDre] = useState(false);
  const [dre, setDre] = useState<DreData>({
    grossRevenue: 0,
    deductions: 0,
    netRevenue: 0,
    operationalExpenses: 0,
    result: 0,
  });

  async function loadData() {
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData.user) {
      console.log('Usuario nao autenticado');
      return;
    }

    const name =
      userData.user.user_metadata?.name ||
      userData.user.email?.split('@')[0] ||
      'Usuario';

    setUserName(name);

    const { data, error } = await supabase
      .from('transactions')
      .select('amount, type')
      .eq('user_id', userData.user.id);

    if (error) {
      console.log(error);
      return;
    }

    const transactions: Transaction[] = data || [];

    let totalIncome = 0;
    let totalExpense = 0;
    let totalDeductions = 0;

    transactions.forEach((item) => {
      if (item.type === 'income') {
        totalIncome += Number(item.amount);
      }

      if (item.type === 'expense') {
        totalExpense += Number(item.amount);
      }

      if (item.type === 'deduction') {
        totalDeductions += Number(item.amount);
      }
    });

    const grossRevenue = totalIncome;
    const deductions = totalDeductions;
    const netRevenue = grossRevenue - deductions;
    const operationalExpenses = totalExpense;
    const result = netRevenue - operationalExpenses;

    setIncome(grossRevenue);
    setExpense(operationalExpenses);
    setBalance(result);

    setDre({
      grossRevenue,
      deductions,
      netRevenue,
      operationalExpenses,
      result,
    });
  }

  function handleGenerateDre() {
    setShowDre((prev) => !prev);
  }

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const totalFlow = income + expense;
  const incomePercent = totalFlow > 0 ? (income / totalFlow) * 100 : 0;
  const expensePercent = totalFlow > 0 ? (expense / totalFlow) * 100 : 0;
  const balanceBase = income > 0 ? income : 1;
  const balancePercent = Math.min((Math.abs(balance) / balanceBase) * 100, 100);

  const monthLabel = new Date().toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
  });

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.topHeader}>
        <View>
          <Text style={styles.greeting}>Ola, {userName}</Text>
          <Text style={styles.monthText}>Resumo de {monthLabel}</Text>
        </View>

        <View style={styles.profileBadge}>
          <Ionicons name="person-outline" size={22} color="#fff" />
        </View>
      </View>

      <Text style={styles.title}>Dashboard</Text>

      <View style={styles.balanceCard}>
        <View style={styles.balanceHeader}>
          <View>
            <Text style={styles.balanceLabel}>Lucro / Prejuizo</Text>
            <Text style={[styles.balanceValue, balance < 0 && styles.negativeBalance]}>
              R$ {balance.toFixed(2)}
            </Text>
          </View>

          <View style={styles.balanceIconBox}>
            <Ionicons
              name={balance >= 0 ? 'wallet-outline' : 'alert-circle-outline'}
              size={26}
              color="#fff"
            />
          </View>
        </View>

        <View style={styles.chartTrack}>
          <View
            style={[
              styles.chartFill,
              balance >= 0 ? styles.balanceFill : styles.expenseFill,
              { width: `${balancePercent}%` },
            ]}
          />
        </View>

        <Text style={styles.chartLegend}>
          {balance >= 0 ? 'Resultado positivo no periodo' : 'Resultado negativo no periodo'}
        </Text>
      </View>

      <View style={styles.row}>
        <View style={[styles.smallCard, styles.incomeCard]}>
          <View style={styles.smallHeader}>
            <Text style={styles.smallLabel}>Entradas</Text>
            <View style={styles.incomeIconBox}>
              <Ionicons name="arrow-up-outline" size={20} color="#4CAF50" />
            </View>
          </View>

          <Text style={styles.incomeValue}>R$ {income.toFixed(2)}</Text>

          <View style={styles.smallTrack}>
            <View
              style={[
                styles.smallFill,
                styles.incomeFill,
                { width: `${incomePercent}%` },
              ]}
            />
          </View>

          <Text style={styles.smallLegend}>{incomePercent.toFixed(0)}% do fluxo</Text>
        </View>

        <View style={[styles.smallCard, styles.expenseCard]}>
          <View style={styles.smallHeader}>
            <Text style={styles.smallLabel}>Saidas</Text>
            <View style={styles.expenseIconBox}>
              <Ionicons name="arrow-down-outline" size={20} color="#F44336" />
            </View>
          </View>

          <Text style={styles.expenseValue}>R$ {expense.toFixed(2)}</Text>

          <View style={styles.smallTrack}>
            <View
              style={[
                styles.smallFill,
                styles.expenseFill,
                { width: `${expensePercent}%` },
              ]}
            />
          </View>

          <Text style={styles.smallLegend}>{expensePercent.toFixed(0)}% do fluxo</Text>
        </View>
      </View>

      <View style={styles.compareCard}>
        <Text style={styles.sectionTitle}>Comparativo</Text>

        <View style={styles.compareRow}>
          <Text style={styles.compareLabel}>Entradas</Text>
          <Text style={styles.compareValue}>R$ {income.toFixed(2)}</Text>
        </View>

        <View style={styles.compareBarBg}>
          <View
            style={[
              styles.compareBarFill,
              styles.incomeFill,
              { width: `${incomePercent}%` },
            ]}
          />
        </View>

        <View style={[styles.compareRow, { marginTop: 14 }]}>
          <Text style={styles.compareLabel}>Saidas</Text>
          <Text style={styles.compareValue}>R$ {expense.toFixed(2)}</Text>
        </View>

        <View style={styles.compareBarBg}>
          <View
            style={[
              styles.compareBarFill,
              styles.expenseFill,
              { width: `${expensePercent}%` },
            ]}
          />
        </View>
      </View>

      <Pressable style={styles.dreButton} onPress={handleGenerateDre}>
        <Ionicons name="document-text-outline" size={20} color="#0c0c1b" />
        <Text style={styles.dreButtonText}>
          {showDre ? 'Ocultar DRE' : 'Gerar DRE'}
        </Text>
      </Pressable>

      {showDre && (
        <View style={styles.dreCard}>
          <Text style={styles.sectionTitle}>Demonstracao do Resultado do Exercicio</Text>
          <Text style={styles.dreSubtitle}>Estrutura resumida do periodo</Text>

          <View style={styles.dreRow}>
            <Text style={styles.dreLabel}>Receita bruta</Text>
            <Text style={styles.dreIncome}>R$ {dre.grossRevenue.toFixed(2)}</Text>
          </View>

          <View style={styles.dreRow}>
            <Text style={styles.dreLabel}>Deducoes</Text>
            <Text style={styles.dreExpense}>R$ {dre.deductions.toFixed(2)}</Text>
          </View>

          <View style={styles.dreRow}>
            <Text style={styles.dreLabel}>Receita liquida</Text>
            <Text style={styles.dreIncome}>R$ {dre.netRevenue.toFixed(2)}</Text>
          </View>

          <View style={styles.dreRow}>
            <Text style={styles.dreLabel}>Despesas operacionais</Text>
            <Text style={styles.dreExpense}>R$ {dre.operationalExpenses.toFixed(2)}</Text>
          </View>

          <View style={styles.dreDivider} />

          <View style={styles.dreRow}>
            <Text style={styles.dreResultLabel}>Lucro / Prejuizo</Text>
            <Text style={[styles.dreResultValue, dre.result < 0 && styles.negativeBalance]}>
              R$ {dre.result.toFixed(2)}
            </Text>
          </View>
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
    paddingTop: 50,
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },
  greeting: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  monthText: {
    marginTop: 4,
    fontSize: 14,
    color: '#b8b8c7',
    textTransform: 'capitalize',
  },
  profileBadge: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#23263a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 26,
    color: '#fff',
    fontWeight: 'bold',
    marginBottom: 20,
  },
  balanceCard: {
    backgroundColor: '#1A1A2E',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  balanceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 18,
  },
  balanceLabel: {
    color: '#b8b8c7',
    fontSize: 15,
    marginBottom: 8,
  },
  balanceValue: {
    color: '#99CF1D',
    fontSize: 32,
    fontWeight: 'bold',
  },
  negativeBalance: {
    color: '#F44336',
  },
  balanceIconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#2B2B40',
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  smallCard: {
    flex: 1,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
  },
  incomeCard: {
    backgroundColor: '#16261c',
    borderColor: 'rgba(76,175,80,0.15)',
  },
  expenseCard: {
    backgroundColor: '#2A1717',
    borderColor: 'rgba(244,67,54,0.15)',
  },
  smallHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  smallLabel: {
    color: '#d6d6de',
    fontSize: 14,
  },
  incomeIconBox: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  expenseIconBox: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  incomeValue: {
    color: '#4CAF50',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 14,
  },
  expenseValue: {
    color: '#F44336',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 14,
  },
  chartTrack: {
    width: '100%',
    height: 12,
    backgroundColor: '#2A2A3C',
    borderRadius: 999,
    overflow: 'hidden',
    marginBottom: 10,
  },
  chartFill: {
    height: '100%',
    borderRadius: 999,
  },
  smallTrack: {
    width: '100%',
    height: 10,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 999,
    overflow: 'hidden',
    marginBottom: 8,
  },
  smallFill: {
    height: '100%',
    borderRadius: 999,
  },
  incomeFill: {
    backgroundColor: '#4CAF50',
  },
  expenseFill: {
    backgroundColor: '#F44336',
  },
  balanceFill: {
    backgroundColor: '#99CF1D',
  },
  chartLegend: {
    color: '#b8b8c7',
    fontSize: 13,
  },
  smallLegend: {
    color: '#c7c7d1',
    fontSize: 12,
  },
  compareCard: {
    backgroundColor: '#1A1A2E',
    borderRadius: 18,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 14,
  },
  compareRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  compareLabel: {
    color: '#d6d6de',
    fontSize: 14,
  },
  compareValue: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  compareBarBg: {
    width: '100%',
    height: 12,
    backgroundColor: '#2A2A3C',
    borderRadius: 999,
    overflow: 'hidden',
  },
  compareBarFill: {
    height: '100%',
    borderRadius: 999,
  },
  dreButton: {
    backgroundColor: '#99CF1D',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 16,
  },
  dreButtonText: {
    color: '#0c0c1b',
    fontSize: 16,
    fontWeight: 'bold',
  },
  dreCard: {
    backgroundColor: '#1A1A2E',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  dreSubtitle: {
    color: '#b8b8c7',
    fontSize: 13,
    marginBottom: 14,
  },
  dreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  dreLabel: {
    color: '#d6d6de',
    fontSize: 15,
  },
  dreIncome: {
    color: '#4CAF50',
    fontSize: 15,
    fontWeight: 'bold',
  },
  dreExpense: {
    color: '#F44336',
    fontSize: 15,
    fontWeight: 'bold',
  },
  dreDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginBottom: 14,
  },
  dreResultLabel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  dreResultValue: {
    color: '#99CF1D',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
