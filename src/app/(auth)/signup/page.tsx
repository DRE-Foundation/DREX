// Página de cadastro de usuário, onde os usuários podem criar uma nova conta fornecendo seu nome, email, telefone e senha.
//  A função handleSignup é responsável por lidar com o processo de cadastro usando o Supabase,
//  e a interface do usuário é construída usando componentes do React Native para criar um formulário de cadastro amigável 
// e responsivo.

import colors from '@/constants/colors';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../../lib/supabase';

export default function Signup() {

    const [name, setName] = useState('');//useState para armazenar o nome do usuário, inicialmente vazio
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState(''); //dinamicamente atualizado conforme o usuário digita
    const [phone, setPhone] = useState(''); 
    const [loading, setLoading] = useState(false); // useState para controlar o estado de carreg durante o cadastro

    //Função assíncrona que lida com o processo de cadastro do usuário usando o Supabase. 
    // Ela define o estado de carregamento,
    async function handleSignup() { 
           setLoading(true);

           const { error } = await supabase.auth.signUp({
            email: email,
            phone: phone,
            password: password,
            options: {
                data: {
                    name: name, //Armazena o nome do usuário como um campo personalizado no perfil do Supabase
                    phone: phone, //Armazena o telefone do usuário como um campo personalizado no perfil do Supabase
                },
            },
        })

        if (error) {
            Alert.alert('Erro', error.message); //Exibe um alerta com a mensagem de erro caso o cadastro falhe
            setLoading(false);
            return;
        }

        setLoading(false);
        router.replace('/(auth)/signin/page'); //Redireciona o usuário para a tela de login após um cadastro bem-sucedido
        
    }

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.zinc, }}>
            <KeyboardAvoidingView 
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'} //Define o comportamento do KeyboardAvoidingView com base na plataforma (iOS ou Android)
                style={{ flex: 1 }}
            >
                <ScrollView 
                    style={{ flex: 1 }}
                    bounces={false} //Desativa o efeito de "bounce" ao rolar além do conteúdo, proporcionando uma experiência de rolagem mais suave e controlada.
                    scrollEnabled={true} //Permite que o ScrollView seja rolável, garantindo que os usuários possam acessar todo o conteúdo, mesmo em telas menores ou quando o teclado estiver ativo.
                >
                <View style={styles.container}>
                    <View style={styles.header}>  

                        <Pressable //Botão para voltar à tela anterior, usando o router do Expo para navegar para trás
                            style={styles.backButton}
                            onPress={() => router.back()}   
                        >
                            <Ionicons name="arrow-back" size={24} color={colors.white} />
                        </Pressable>    
                            
                        <Text style={styles.logoText }>
                            DRE<Text style={{ color: colors.green }}>Fácil</Text>
                        </Text>

                        <Text style={styles.slogan}>
                            Criar uma conta é fácil e rápido!
                        </Text>

                    </View>

                    <View style={styles.form}>
                        <View>
                            <Text style={styles.label}>
                                Nome Completo
                            </Text>
                            <TextInput
                                style={styles.input}
                                placeholder="Digite seu nome completo"
                                placeholderTextColor={colors.gray}
                                value={name}
                                onChangeText={setName} //Atualiza o estado do nome conforme o usuário digita
                            />
                        </View>

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
                                Telefone
                            </Text>
                            <TextInput
                                style={styles.input}
                                placeholder="Digite seu telefone"
                                placeholderTextColor={colors.gray}
                                value={phone}
                                onChangeText={setPhone} //Atualiza o estado do telefone conforme o usuário digita
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
                                {loading ? 'Criando conta...' : 'Criar Conta'}
                            </Text>
                        </Pressable>
                    
                    </View>
                </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
);
}

const styles = StyleSheet.create({
    container: {   
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
    backButton: {
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        padding: 8,
        borderRadius: 8,
        marginBottom: 20,
        alignSelf: 'flex-start',
    },

});
