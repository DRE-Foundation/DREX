// app/(panel)/ai/index.tsx — versão com debug completo

import { chatFinanceiro, ChatMessage, Transaction } from '@/lib/groq/chatFinanceiro';
import { supabase } from '@/lib/supabase'; // ← ajuste se necessário
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

const QUICK_SUGGESTIONS = [
  'Quanto gastei esse mês?',
  'Quais foram minhas receitas?',
  'Quanto gastei com Uber?',
  'Qual meu saldo atual?',
  'Maiores gastos por categoria',
];

export default function AIPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(true);
  const [debugInfo, setDebugInfo] = useState<string>(''); // ← mostra info de debug na tela
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    async function fetchTransactions() {
      try {
        // 1. Verifica se o usuário está logado
        const { data: sessionData, error: sessionError } = await supabase.auth.getUser();
        console.log('[AI] Auth user:', JSON.stringify(sessionData?.user?.id));
        console.log('[AI] Auth error:', sessionError);

        if (sessionError || !sessionData?.user) {
          setDebugInfo('❌ Usuário não autenticado. Verifique o login.');
          setLoadingTransactions(false);
          return;
        }

        const userId = sessionData.user.id;

        // 2. Busca transações — tenta COM e SEM filtro de user_id para debug
        const { data: allData, error: allError } = await supabase
          .from('transactions')
          .select('*')
          .limit(5);

        console.log('[AI] Todas transações (sem filtro, primeiras 5):', JSON.stringify(allData));
        console.log('[AI] Erro sem filtro:', allError);

        const { data, error } = await supabase
          .from('transactions')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(200);

        console.log('[AI] Transações do usuário:', data?.length ?? 0);
        console.log('[AI] Erro com filtro:', error);

        if (error) {
          setDebugInfo(`❌ Erro Supabase: ${error.message}`);
          throw error;
        }

        if (!data || data.length === 0) {
          // Mostra os user_ids das transações existentes para comparar
          const sampleUserIds = allData?.map((t: any) => t.user_id).slice(0, 3);
          const msg = `⚠️ Nenhuma transação encontrada para user_id: ${userId}\n\nUser IDs nas transações existentes: ${JSON.stringify(sampleUserIds)}`;
          console.warn('[AI]', msg);
          setDebugInfo(msg);
        } else {
          setDebugInfo(`✅ ${data.length} transações carregadas para o usuário.`);
        }

        setTransactions(data ?? []);
      } catch (err: any) {
        console.error('[AI] fetchTransactions error:', err);
        setDebugInfo(`❌ Exceção: ${err?.message ?? String(err)}`);
      } finally {
        setLoadingTransactions(false);
      }
    }

    fetchTransactions();
  }, []);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages, loading]);

  const sendMessage = useCallback(
    async (text?: string) => {
      const userText = (text ?? input).trim();
      if (!userText || loading) return;

      const userMessage: ChatMessage = { role: 'user', content: userText };
      const newHistory = [...messages, userMessage];

      setMessages(newHistory);
      setInput('');
      setLoading(true);

      try {
        console.log('[AI] Enviando mensagem. Transações disponíveis:', transactions.length);
        console.log('[AI] API Key existe?', !!process.env.EXPO_PUBLIC_GROQ_API_KEY);

        const reply = await chatFinanceiro(userText, transactions, messages);

        console.log('[AI] Resposta recebida:', reply?.substring(0, 100));
        setMessages([...newHistory, { role: 'assistant', content: reply }]);
      } catch (err: any) {
        console.error('[AI] sendMessage error:', err);
        // Mostra o erro REAL na tela em vez de mensagem genérica
        setMessages([
          ...newHistory,
          {
            role: 'assistant',
            content: `❌ Erro: ${err?.message ?? String(err)}`,
          },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [input, loading, messages, transactions]
  );

  const clearChat = () => setMessages([]);

  if (loadingTransactions) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#6C63FF" />
          <Text style={styles.loadingText}>Carregando seu extrato...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Assistente Financeiro</Text>
            <Text style={styles.headerSub}>
              {transactions.length} transações carregadas
            </Text>
          </View>
          {messages.length > 0 && (
            <TouchableOpacity onPress={clearChat} style={styles.clearBtn}>
              <Text style={styles.clearBtnText}>Limpar</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Debug Info — remova após resolver o problema */}
        {debugInfo !== '' && (
          <View style={styles.debugBox}>
            <Text style={styles.debugText}>{debugInfo}</Text>
          </View>
        )}

        {/* Chat Area */}
        <ScrollView
          ref={scrollRef}
          style={styles.chatArea}
          contentContainerStyle={styles.chatContent}
          showsVerticalScrollIndicator={false}
        >
          {messages.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>💬</Text>
              <Text style={styles.emptyTitle}>Olá! Sou seu assistente financeiro.</Text>
              <Text style={styles.emptySubtitle}>
                Pergunte sobre seus gastos, receitas ou categorias do extrato.
              </Text>
              <View style={styles.suggestions}>
                {QUICK_SUGGESTIONS.map((s) => (
                  <TouchableOpacity
                    key={s}
                    style={styles.suggestionChip}
                    onPress={() => sendMessage(s)}
                  >
                    <Text style={styles.suggestionText}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ) : (
            <>
              {messages.map((msg, i) => (
                <View
                  key={i}
                  style={[
                    styles.bubble,
                    msg.role === 'user' ? styles.bubbleUser : styles.bubbleAssistant,
                  ]}
                >
                  {msg.role === 'assistant' && (
                    <Text style={styles.bubbleLabel}>🤖 Assistente</Text>
                  )}
                  <Text
                    style={[
                      styles.bubbleText,
                      msg.role === 'user' ? styles.bubbleTextUser : styles.bubbleTextAssistant,
                    ]}
                  >
                    {msg.content}
                  </Text>
                </View>
              ))}
              {loading && (
                <View style={[styles.bubble, styles.bubbleAssistant]}>
                  <Text style={styles.bubbleLabel}>🤖 Assistente</Text>
                  <View style={styles.typingIndicator}>
                    <ActivityIndicator size="small" color="#6C63FF" />
                    <Text style={styles.typingText}>Analisando seu extrato...</Text>
                  </View>
                </View>
              )}
            </>
          )}
        </ScrollView>

        {/* Input */}
        <View style={styles.inputArea}>
          <TextInput
            style={styles.input}
            placeholder="Pergunte sobre seu extrato..."
            placeholderTextColor="#999"
            value={input}
            onChangeText={setInput}
            multiline
            maxLength={500}
            returnKeyType="send"
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!input.trim() || loading) && styles.sendBtnDisabled]}
            onPress={() => sendMessage()}
            disabled={!input.trim() || loading}
          >
            <Text style={styles.sendBtnText}>➤</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F13' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16 },
  loadingText: { color: '#aaa', fontSize: 15 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1E1E2A',
  },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#FFFFFF', letterSpacing: -0.5 },
  headerSub: { fontSize: 12, color: '#6C63FF', marginTop: 2 },
  clearBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: '#333' },
  clearBtnText: { color: '#888', fontSize: 13 },
  // Debug
  debugBox: {
    margin: 12,
    padding: 12,
    backgroundColor: '#1A1A10',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#444',
  },
  debugText: { color: '#FFD700', fontSize: 12, lineHeight: 18 },
  // Chat
  chatArea: { flex: 1 },
  chatContent: { padding: 16, paddingBottom: 8, flexGrow: 1 },
  emptyState: { flex: 1, alignItems: 'center', paddingTop: 40, paddingHorizontal: 8 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#FFF', textAlign: 'center', marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: '#888', textAlign: 'center', lineHeight: 21, marginBottom: 32 },
  suggestions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10 },
  suggestionChip: { backgroundColor: '#1A1A26', borderWidth: 1, borderColor: '#2A2A3A', paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20 },
  suggestionText: { color: '#CCC', fontSize: 13 },
  bubble: { marginBottom: 14, maxWidth: '88%', borderRadius: 16, padding: 14 },
  bubbleUser: { backgroundColor: '#6C63FF', alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  bubbleAssistant: { backgroundColor: '#1A1A26', alignSelf: 'flex-start', borderBottomLeftRadius: 4, borderWidth: 1, borderColor: '#2A2A3A' },
  bubbleLabel: { fontSize: 11, color: '#6C63FF', marginBottom: 6, fontWeight: '600' },
  bubbleText: { fontSize: 14, lineHeight: 21 },
  bubbleTextUser: { color: '#FFFFFF' },
  bubbleTextAssistant: { color: '#E0E0E0' },
  typingIndicator: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  typingText: { color: '#888', fontSize: 13, fontStyle: 'italic' },
  inputArea: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#1E1E2A',
    gap: 10,
    backgroundColor: '#0F0F13',
  },
  input: {
    flex: 1,
    backgroundColor: '#1A1A26',
    borderWidth: 1,
    borderColor: '#2A2A3A',
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingVertical: 12,
    color: '#FFF',
    fontSize: 14,
    maxHeight: 120,
    lineHeight: 20,
  },
  sendBtn: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#6C63FF', justifyContent: 'center', alignItems: 'center' },
  sendBtnDisabled: { backgroundColor: '#2A2A3A' },
  sendBtnText: { color: '#FFF', fontSize: 18, marginLeft: 2 },
});