
import React, { useState, useEffect } from 'react';
import { loginWithEmail, registerWithEmail, signInWithGithub, signInWithGoogle, loginAsDev } from '../services/auth';
import { Mail, Lock, User, ArrowRight, Loader2, AlertCircle, Eye, EyeOff, AtSign, Github, Bug, Copy, Check, AlertTriangle } from 'lucide-react';

export const AuthPage: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [nickname, setNickname] = useState('');
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState(false);
  
  const [isRestrictedEnv, setIsRestrictedEnv] = useState(false);

  useEffect(() => {
      if (window.location.protocol === 'blob:' || window.location.href.includes('scf.usercontent.goog')) {
          setIsRestrictedEnv(true);
      }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      if (isLogin) {
        await loginWithEmail(email, password);
      } else {
        if (!name.trim()) throw new Error("Nome é obrigatório.");
        if (!nickname.trim()) throw new Error("Apelido é obrigatório.");
        if (nickname.includes(' ')) throw new Error("Apelido não pode conter espaços.");
        if (password.length < 6) throw new Error("Senha deve ter no mínimo 6 caracteres.");
        
        await registerWithEmail(email, password, name, nickname);
      }
    } catch (err: any) {
      console.error(err);
      let msg = err.message || "Ocorreu um erro. Tente novamente.";
      if (err.code === 'auth/email-already-in-use') msg = "Este email já está cadastrado.";
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSocialLogin = async (provider: 'github' | 'google') => {
    if (isRestrictedEnv) {
        setError("Login Social indisponível neste ambiente de preview (URL blob). Use o Modo Teste.");
        return;
    }

    setError(null);
    setIsLoading(true);
    try {
        if (provider === 'github') await signInWithGithub();
        else await signInWithGoogle();
    } catch (err: any) {
        console.error(`${provider} Login Error:`, err);
        let msg = `Falha ao autenticar com ${provider}.`;
        if (err.code === 'auth/account-exists-with-different-credential') {
            msg = "Conta já existe com credenciais diferentes.";
        }
        if (err.code === 'auth/unauthorized-domain') {
            msg = "Domínio não autorizado no Firebase.";
        }
        setError(msg);
        setIsLoading(false);
    }
  };

  const handleDevLogin = async () => {
      setError(null);
      setIsLoading(true);
      try {
          await loginAsDev();
      } catch (e) {
          setError("Erro no bypass de dev.");
          setIsLoading(false);
      }
  };

  const handleCopyUrl = () => {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-base-950 flex flex-col items-center justify-center p-4 relative">
      
      {/* Botão Copiar URL - APENAS no ambiente de preview/restrito */}
      {isRestrictedEnv && (
        <button 
            onClick={handleCopyUrl}
            className="absolute top-4 right-4 flex items-center gap-2 px-3 py-2 bg-base-900 border border-base-800 rounded-lg text-xs font-medium text-base-muted hover:text-primary-400 hover:border-primary-500/30 transition-all shadow-sm z-50"
            title="Copiar URL para abrir no navegador padrão"
        >
            {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
            {copied ? <span className="text-green-400">Link Copiado!</span> : "Copiar URL"}
        </button>
      )}

      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary-600 rounded-2xl mx-auto flex items-center justify-center shadow-2xl shadow-primary-900/50 mb-4 rotate-3 hover:rotate-6 transition-transform">
             <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" className="w-8 h-8">
                <rect width="24" height="24" rx="6" fillOpacity="0" />
                <path d="M6 16l6-8 6 8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                <circle cx="12" cy="16" r="1.5" fill="currentColor"/>
             </svg>
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Nexion</h1>
          <p className="text-base-muted mt-2">Gerencie projetos, docs e tarefas com IA.</p>
        </div>

        <div className="bg-base-900 border border-base-800 rounded-2xl p-8 shadow-2xl">
          <h2 className="text-xl font-semibold text-white mb-6 text-center">
            {isLogin ? 'Bem-vindo de volta' : 'Criar nova conta'}
          </h2>

          {isRestrictedEnv && (
             <div className="mb-6 p-4 bg-amber-900/20 border border-amber-500/30 rounded-xl text-amber-200 text-xs animate-in fade-in slide-in-from-top-2">
                <p className="font-bold flex items-center gap-2 mb-2">
                    <AlertTriangle size={14} className="text-amber-400" />
                    Ambiente de Preview
                </p>
                <p className="mb-2 opacity-90">
                    O Login Social (GitHub/Google) não funciona neste ambiente temporário.
                </p>
                <p>
                    Use o <strong className="text-amber-400">Modo Teste</strong> abaixo.
                </p>
             </div>
          )}

          {error && (
            <div className="mb-4 p-3 bg-red-900/20 border border-red-900/50 rounded-lg flex items-center gap-2 text-red-400 text-sm animate-in fade-in slide-in-from-top-2">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          <div className="space-y-3">
             {/* Botão Modo Teste - APENAS no ambiente de preview/restrito */}
             {isRestrictedEnv && (
                 <button 
                    onClick={handleDevLogin}
                    disabled={isLoading}
                    className="w-full font-medium py-3 rounded-xl transition-all flex items-center justify-center gap-2 text-sm shadow-lg bg-amber-600 hover:bg-amber-500 text-white shadow-amber-900/20 border border-amber-400/50"
                  >
                     <Bug size={18} />
                     Entrar com Modo Teste
                  </button>
             )}

             <div className="grid grid-cols-2 gap-3">
                 <button 
                    onClick={() => handleSocialLogin('github')}
                    disabled={isLoading || isRestrictedEnv}
                    className="w-full bg-[#24292e] hover:bg-[#2f363d] text-white font-medium py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2 border border-white/10 disabled:opacity-50"
                  >
                    <Github size={18} /> GitHub
                  </button>
                  <button 
                    onClick={() => handleSocialLogin('google')}
                    disabled={isLoading || isRestrictedEnv}
                    className="w-full bg-white hover:bg-gray-100 text-gray-900 font-medium py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24"><path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                    Google
                  </button>
             </div>

              <div className="flex items-center gap-4 py-2">
                <div className="h-px bg-base-800 flex-1"></div>
                <span className="text-base-muted text-xs uppercase">Ou email</span>
                <div className="h-px bg-base-800 flex-1"></div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {!isLogin && (
                  <>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 text-base-muted" size={18} />
                      <input 
                        type="text" 
                        placeholder="Nome completo"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full bg-base-950 border border-base-700 text-white pl-10 pr-4 py-3 rounded-xl focus:border-primary-500 focus:outline-none transition-colors placeholder-base-700"
                        required
                      />
                    </div>
                    <div className="relative">
                      <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 text-base-muted" size={18} />
                      <input 
                        type="text" 
                        placeholder="Apelido único (ex: dev_ninja)"
                        value={nickname}
                        onChange={(e) => setNickname(e.target.value.toLowerCase().replace(/\s/g, ''))}
                        className="w-full bg-base-950 border border-base-700 text-white pl-10 pr-4 py-3 rounded-xl focus:border-primary-500 focus:outline-none transition-colors placeholder-base-700"
                        required
                      />
                    </div>
                  </>
                )}

                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-base-muted" size={18} />
                  <input 
                    type="email" 
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-base-950 border border-base-700 text-white pl-10 pr-4 py-3 rounded-xl focus:border-primary-500 focus:outline-none transition-colors placeholder-base-700"
                    required
                  />
                </div>

                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-base-muted" size={18} />
                  <input 
                    type={showPassword ? "text" : "password"}
                    placeholder="Senha"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-base-950 border border-base-700 text-white pl-10 pr-12 py-3 rounded-xl focus:border-primary-500 focus:outline-none transition-colors placeholder-base-700"
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-base-muted hover:text-base-text transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>

                <button 
                  type="submit" 
                  disabled={isLoading}
                  className="w-full bg-primary-600 hover:bg-primary-500 text-white font-medium py-3 rounded-xl transition-all shadow-lg shadow-primary-900/20 flex items-center justify-center gap-2 mt-2"
                >
                  {isLoading ? <Loader2 className="animate-spin" size={20} /> : (
                    <>
                      {isLogin ? 'Entrar' : 'Cadastrar'}
                      <ArrowRight size={18} />
                    </>
                  )}
                </button>
              </form>
          </div>

          <p className="mt-6 text-center text-sm text-base-muted">
            {isLogin ? "Não tem uma conta?" : "Já tem uma conta?"}{' '}
            <button 
              onClick={() => setIsLogin(!isLogin)} 
              className="text-primary-400 hover:text-primary-300 font-medium ml-1"
            >
              {isLogin ? 'Cadastre-se' : 'Faça Login'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};
