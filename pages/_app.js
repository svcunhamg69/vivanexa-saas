// pages/_app.js
import '../styles/globals.css';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabase'; // Certifique-se de que o caminho está correto

function MyApp({ Component, pageProps }) {
  const [session, setSession] = useState(null);
  const router = useRouter();

  useEffect(() => {
    // Verifica a sessão inicial
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    // Escuta por mudanças na autenticação
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        if (event === 'SIGNED_OUT') {
          router.push('/'); // Redireciona para a página de login ao deslogar
        } else if (event === 'SIGNED_IN' && router.pathname === '/') {
          router.push('/dashboard'); // Redireciona para o dashboard ao logar
        }
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [router]);

  // Páginas que não exigem autenticação
  const publicPages = ['/', '/sign/[token]']; // Adicione outras páginas públicas aqui, como a de assinatura

  // Se não há sessão e a página não é pública, redireciona para o login
  if (!session && !publicPages.includes(router.pathname)) {
    // Você pode mostrar um spinner ou uma mensagem de carregamento aqui
    return <p>Carregando...</p>;
  }

  // Se a página é de login e o usuário já está logado, redireciona para o dashboard
  if (session && router.pathname === '/') {
    router.push('/dashboard');
    return <p>Redirecionando...</p>;
  }

  return <Component {...pageProps} />;
}

export default MyApp;
