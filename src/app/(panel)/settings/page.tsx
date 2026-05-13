import colors from '@/constants/colors';
import { StyleSheet, Text, View } from 'react-native';

export default function SettingsPage() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Ajustes</Text>
      <Text style={styles.text}>
        Este espaco pode receber preferencias da conta, notificacoes e configuracoes da aplicacao.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.zinc,
    padding: 24,
    justifyContent: 'center',
  },
  title: {
    color: colors.white,
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 12,
  },
  text: {
    color: '#b5b9c9',
    fontSize: 16,
    lineHeight: 24,
  },
});
