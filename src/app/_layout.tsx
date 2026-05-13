// O arquivo _layout.tsx é o layout raiz da aplicação, onde a estrutura de navegação é definida usando o componente Stack do Expo Router.
// stack é um componente que permite criar uma pilha de telas, 
// onde cada tela é empilhada sobre a anterior.

import { supabase } from "@/lib/supabase";
import { Stack, router } from "expo-router";
import { useEffect } from "react";
import { AuthProvider, useAuth } from '../contexts/AuthContexts';

// O componente RootLayout é o componente raiz da aplicação, onde o AuthProvider é usado para envolver toda a aplicação,
export default function RootLayout() {
    return (
        <AuthProvider>
            <MainLayout />
        </AuthProvider>
    )
}

// O componente MainLayout é onde a lógica de autenticação é implementada. 
// Ele usa o hook useAuth para acessar a função setAuth, que é usada para atualizar o estado de autenticação do usuário. 
// O useEffect é usado para configurar um listener para mudanças no estado de autenticação usando supabase.auth.onAuthStateChange. 
// Quando o estado de autenticação muda, o listener verifica se há uma sessão ativa. 
// Se houver, ele atualiza o estado de autenticação com as informações do usuário e redireciona para a página de perfil. 
// Se não houver uma sessão ativa, ele limpa o estado de autenticação e redireciona para a página de login.
function MainLayout() {
    const { setAuth} = useAuth();

    useEffect(() => { 
        const { data: listener } = supabase.auth.onAuthStateChange(
            (event, session) => {
            
            if (session){
                setAuth(session.user);
                //usuario autenticado, redireciona para a página de transações
                router.replace('/(panel)/transactions/page');
                return;
            }
            //não logado vai para a página de login

                setAuth(null);
                router.replace('/(auth)/signin/page');
        })

        return () => {
            listener.subscription.unsubscribe();
        }   
    }, [setAuth])

    return (
        <Stack screenOptions={{
            headerShown: false,
        }}/>       
    )
}
