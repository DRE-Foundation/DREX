// Este arquivo define o contexto de autenticação para a aplicação, 
// permitindo que os componentes acessem e atualizem o estado do usuário autenticado. 
// Ele utiliza o React Context API para criar um contexto de autenticação e um provedor que envolve os componentes filhos. 
// O estado do usuário é gerenciado usando o hook useState, e a função setAuth é fornecida para atualizar o estado do usuário. 
// O hook useAuth é exportado para facilitar o acesso ao contexto de autenticação em outros componentes da aplicação.

import { User } from '@supabase/supabase-js';
import { createContext, use, useState } from 'react';

interface AuthContextprops {
  user: User | null;
  setAuth: (authUser: User | null) => void;
  
}

const AuthContext = createContext({} as AuthContextprops);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);

  function setAuth(authUser: User | null) {
    setUser(authUser);
  }

  return (
    <AuthContext.Provider value={{ user, setAuth }}>
      {children}
    </AuthContext.Provider>
  );

}

export const useAuth = () => use(AuthContext) 