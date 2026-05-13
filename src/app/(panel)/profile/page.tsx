// Página de perfil do usuário, onde os usuários autenticados podem visualizar suas informações e sair da conta.
// A função handleSignOut é responsável por lidar com o processo de logout usando o Supabase,
// e a interface do usuário exibe o email do usuário autenticado e um botão para sair da conta. 

import { useAuth } from '@/contexts/AuthContexts';
import { supabase } from '@/lib/supabase';
import { Alert, Button, StyleSheet, Text, View } from 'react-native';


export default function Profile() {
    const { setAuth, user} = useAuth();


    async function handleSignOut() {
        const { error } = await supabase.auth.signOut();
        setAuth (null);
        
        
        if (error) {
            Alert.alert('Error', 'Erro ao sair: ');
            return;
        }
    }
    
    return (
    <View style={styles.container}>
        <Text>Pagina Profile</Text>
        <Text>{user?.email} </Text>

        <Button
            title="Sair"
            onPress={handleSignOut }
        />


    </View>
);
}

const styles = StyleSheet.create({
    container: {   
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    }, 
 });