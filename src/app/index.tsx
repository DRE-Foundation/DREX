
// O arquivo index.tsx é a tela de login da aplicação, onde um indicador de atividade é exibido enquanto a 
// autenticação do usuário está sendo verificada.

import colors from '@/constants/colors';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

export default function Login() {

   
    return (
    <View style={styles.container}>
       <ActivityIndicator size={55} color={colors.green} />
    </View>
);
}

const styles = StyleSheet.create({
    container: {   
        flex: 1,
        paddingTop: 50,
        backgroundColor: colors.zinc,
        justifyContent: 'center',
        alignItems: 'center',   
    }, 


});