// é a tela de login, onde o usuário pode inserir suas 
// credenciais para acessar o aplicativo. 
// Ele contém campos de entrada para email e senha, um botão de login e um link para a página de cadastro. 
// O design é simples e intuitivo, com uma paleta de cores consistente e uma hierarquia visual clara. 
// O código utiliza o React Native para criar a interface do usuário e gerenciar o estado dos campos de entrada.

import colors from '@/constants/colors';
import { Link, router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { supabase } from '../../../lib/supabase';

export default function Login() {

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState(''); //dinamicamente atualizado conforme o usuário digita
    const [loading, setLoading] = useState(false);

    // async function handleSignup() é responsável por lidar com o processo de login do usuário.
    async function handleSignup() {
        setLoading(true);
        
        const { error } = await supabase.auth.signInWithPassword({
            email: email,
            password: password,
       });
       
       if (error) {
        Alert.alert('Error', error.message);
        setLoading(false);
        return; 

    }   // Se houver um erro durante o processo de login, ele exibe um alerta com a mensagem de erro 
        // e define o estado de carregamento como false para permitir que o usuário tente novamente.
        setLoading(false);
        router.replace('/(panel)/transactions/page');
    }
    
    return (
    <View style={styles.container}>
        <View style={styles.header}>  
            <Text style={styles.logoText }>
                DRE<Text style={{ color: colors.green }}>Fácil</Text>
            </Text>

            <Text style={styles.slogan}>
                Você tem o DRE, a gente tem a solução.
            </Text>
        </View>
        <View style={styles.form}>
            <View>
                <Text style={styles.label}>
                    E-mail
                </Text>
                <TextInput
                    style={styles.input}
                    placeholder="Digite seu e-mail"
                    placeholderTextColor={colors.gray}
                    value={email}
                    onChangeText={setEmail} //Atualiza o estado do email conforme o usuário digita
                />
            </View>
        
            <View>
                    <Text style={styles.label}>
                        Senha
                    </Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Digite sua senha"
                        secureTextEntry
                        placeholderTextColor={colors.gray}
                        value={password}
                        onChangeText={setPassword} //Atualiza o estado da senha conforme o usuário digita
                    />
            </View>
            <Pressable style={styles.button} onPress={handleSignup}>
                <Text style={styles.buttonText}>
                    {loading ? 'Carregando...' : 'Entrar'}
                </Text>
            </Pressable>
            <Link href='/(auth)/signup/page'>
                <Text style={styles.linkText}>
                    Não tem uma conta? Cadastre-se
                </Text>
            </Link>
        </View>
    </View>
);
}

const styles = StyleSheet.create({
    container: {   
        flex: 1,
        paddingTop: 50,
        backgroundColor: colors.zinc,
    }, 
    header: {
        paddingLeft: 14,
        paddingRight: 14,
        marginTop: 40,

    },
    logoText: {
        fontSize: 35,
        fontWeight: 'bold',
        color: colors.white,
        marginBottom: 8,
    },
    slogan: {
        fontSize: 22,
        color: colors.white,
        marginBottom: 34,
        fontStyle: 'italic',
       
    },
    form: {
        flex: 1, 
        paddingLeft: 14,
        paddingRight: 14,
        paddingTop: 35,
        paddingBlockEnd: 35,
        backgroundColor: colors.white,
        borderRadius: 16,
        marginTop: 20,
        gap: 14,
    },
    label: {
        fontSize: 16,
        color: colors.zinc,
        marginBottom: 4,
    },
    input: {
        borderWidth: 1,
        borderColor: colors.gray,
        borderRadius: 8,
        paddingHorizontal: 8,
        paddingTop: 14,
        paddingBottom: 14,
        marginBottom: 16,
    },
    button: {
        backgroundColor: colors.green,
        paddingTop: 14,
        paddingBottom: 14,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
    },
    buttonText: {
        color: colors.zinc,
        fontWeight: 'bold',
        fontSize: 14,
    },
    linkText: {
        fontSize: 16,
        textAlign: 'center',
        textDecorationLine: 'underline',
    },

});
