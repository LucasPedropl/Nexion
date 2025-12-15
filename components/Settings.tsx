
import React, { useState } from 'react';
import { ThemeId, Theme } from '../types';
import { Check, Palette, ShieldCheck, Database, ArrowLeft, Github, Loader2, Link as LinkIcon } from 'lucide-react';
import { auth, linkGithubAccount } from '../services/auth';

interface SettingsProps {
  currentTheme: ThemeId;
  onThemeChange: (theme: ThemeId) => void;
}

const THEMES: Theme[] = [
  // Dark Themes
  { id: 'cosmic', name: 'Cosmic (Padrão)', colors: { primary: '#6366f1', background: '#0f172a' } },
  { id: 'dracula', name: 'Dracula', colors: { primary: '#a855f7', background: '#27272a' } },
  { id: 'supabase', name: 'Supabase', colors: { primary: '#3ecf8e', background: '#1c1c1c' } },
  { id: 'cyberpunk', name: 'Cyberpunk', colors: { primary: '#14b8a6', background: '#1a0b2e' } },
  { id: 'matrix', name: 'Matrix', colors: { primary: '#22c55e', background: '#000000' } },
  { id: 'forest', name: 'Forest', colors: { primary: '#10b981', background: '#064e3b' } },
  { id: 'ocean', name: 'Ocean', colors: { primary: '#06b6d4', background: '#164e63' } },
  
  // Warm/Earth Themes
  { id: 'sunset', name: 'Sunset (Laranja)', colors: { primary: '#f97316', background: '#44403c' } },
  { id: 'jungle', name: 'Jungle (Verde)', colors: { primary: '#84cc16', background: '#44403c' } },

  // Monochrome / High Contrast
  { id: 'black', name: 'Midnight (Dark)', colors: { primary: '#ffffff', background: '#000000' } },
  { id: 'high-contrast-dark', name: 'Alto Contraste (Preto)', colors: { primary: '#FFFFFF', background: '#000000' } },
  { id: 'high-contrast-light', name: 'Alto Contraste (Branco)', colors: { primary: '#000000', background: '#FFFFFF' } },

  // Light Themes
  { id: 'light', name: 'Clean (Azul)', colors: { primary: '#4f46e5', background: '#f3f4f6' } },
  { id: 'blossom', name: 'Blossom (Rosa)', colors: { primary: '#f43f5e', background: '#fff1f2' } },
  { id: 'sky', name: 'Sky (Céu)', colors: { primary: '#0ea5e9', background: '#f0f9ff' } },
];

export const Settings: React.FC<SettingsProps> = ({ currentTheme, onThemeChange }) => {
  const [isLinking, setIsLinking] = useState(false);
  const user = auth.currentUser;

  const handleLinkGithub = async () => {
      setIsLinking(true);
      try {
          await linkGithubAccount();
          alert("Conta do GitHub conectada com sucesso!");
      } catch (error: any) {
          console.error(error);
          alert(error.message || "Erro ao conectar conta.");
      } finally {
          setIsLinking(false);
      }
  };

  return (
    <div className="flex flex-col bg-base-900 text-base-text min-h-full">
      {/* Sticky Header Standardized */}
      <div className="h-16 border-b border-base-800 flex items-center px-6 bg-base-950 sticky top-0 z-30 flex-shrink-0">
          <h1 className="text-xl font-bold text-base-text flex items-center gap-3">
            <Palette className="text-primary-500" size={20} /> Configurações
          </h1>
      </div>

      <div className="flex-1 p-8 max-w-4xl mx-auto w-full">
        {/* Seção de Contas Conectadas */}
        <section className="mb-12 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="mb-6">
                <h2 className="text-xl font-semibold text-base-text">Contas Conectadas</h2>
                <p className="text-sm text-base-muted mt-1">Gerencie vínculos com serviços externos.</p>
            </div>

            <div className="bg-base-800 border border-base-700 rounded-xl p-6">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-lg ${user?.githubToken ? 'bg-[#24292e] text-white' : 'bg-base-900 text-base-muted'}`}>
                            <Github size={24} />
                        </div>
                        <div>
                            <h3 className="font-medium text-base-text">GitHub</h3>
                            {user?.githubLogin ? (
                                <p className="text-sm text-green-400 mt-1 flex items-center gap-1">
                                    <Check size={12} /> Conectado como <strong>@{user.githubLogin}</strong>
                                </p>
                            ) : (
                                <p className="text-sm text-base-muted mt-1">
                                    Vincule sua conta para sincronizar repositórios e organizações.
                                </p>
                            )}
                        </div>
                    </div>
                    
                    {!user?.githubLogin && (
                        <button 
                            onClick={handleLinkGithub}
                            disabled={isLinking}
                            className="bg-base-900 hover:bg-base-700 border border-base-700 text-base-text px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                        >
                            {isLinking ? <Loader2 size={16} className="animate-spin" /> : <LinkIcon size={16} />}
                            Conectar
                        </button>
                    )}
                </div>
            </div>
        </section>

        {/* Seção de Temas */}
        <section className="mb-12 animate-in fade-in slide-in-from-bottom-2 duration-300 delay-75">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-base-text">Aparência & Tema</h2>
            <p className="text-sm text-base-muted mt-1">Personalize a interface para se adequar ao seu estilo.</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {THEMES.map((theme) => (
              <button
                key={theme.id}
                onClick={() => onThemeChange(theme.id)}
                className={`group relative overflow-hidden rounded-xl border-2 transition-all duration-300 text-left p-4 hover:scale-[1.02] ${
                  currentTheme === theme.id 
                    ? 'border-primary-500 shadow-lg shadow-primary-500/20' 
                    : 'border-base-700 hover:border-base-600'
                }`}
                style={{ backgroundColor: theme.colors.background }}
              >
                <div className="flex items-center justify-between mb-4">
                  <span className={`font-semibold ${
                    // Lógica simples para contraste do texto no cartão de preview
                    ['light', 'high-contrast-light', 'blossom', 'sky'].includes(theme.id)
                      ? (currentTheme === theme.id ? 'text-gray-900' : 'text-gray-500')
                      : (currentTheme === theme.id ? 'text-white' : 'text-gray-300')
                    }`}>
                    {theme.name}
                  </span>
                  {currentTheme === theme.id && (
                    <div className="bg-primary-500 rounded-full p-1 text-white">
                      <Check size={14} />
                    </div>
                  )}
                </div>

                {/* Preview de Cores */}
                <div className="space-y-2 opacity-80 group-hover:opacity-100 transition-opacity">
                  <div className="h-2 w-full rounded-full bg-gray-700/50 overflow-hidden">
                    <div className="h-full w-2/3" style={{ backgroundColor: theme.colors.primary }}></div>
                  </div>
                  <div className="flex gap-2">
                     <div className="h-8 w-8 rounded-lg border border-white/10" style={{ backgroundColor: theme.colors.background }}></div>
                     <div className="h-8 w-8 rounded-lg border border-white/10" style={{ backgroundColor: theme.colors.primary }}></div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* Status do Sistema */}
        <section className="animate-in fade-in slide-in-from-bottom-2 duration-300 delay-100">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-base-text">Status do Sistema</h2>
            <p className="text-sm text-base-muted mt-1">Informações sobre conexões externas.</p>
          </div>

          <div className="bg-base-800 rounded-xl p-6 border border-base-700">
             <div className="flex items-start gap-4 mb-6">
                <div className="p-3 bg-green-900/30 text-green-400 rounded-lg">
                    <Database size={24} />
                </div>
                <div>
                    <h3 className="font-medium text-base-text">Google Firestore</h3>
                    <p className="text-sm text-base-muted mt-1">
                        O banco de dados está configurado e ativo. Os dados são salvos na nuvem automaticamente.
                    </p>
                    <div className="mt-2 flex items-center gap-2 text-xs text-green-400">
                        <ShieldCheck size={12} /> Conexão Segura
                    </div>
                </div>
             </div>
             
             <div className="flex items-start gap-4">
                <div className={`p-3 rounded-lg ${process.env.API_KEY ? 'bg-indigo-900/30 text-indigo-400' : 'bg-red-900/30 text-red-400'}`}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/></svg>
                </div>
                <div>
                    <h3 className="font-medium text-base-text">Google Gemini AI</h3>
                    <p className="text-sm text-base-muted mt-1">
                        {process.env.API_KEY 
                            ? "A Inteligência Artificial está pronta para processar suas notas e documentos." 
                            : "API Key não encontrada. As funcionalidades de IA estarão indisponíveis."}
                    </p>
                </div>
             </div>
          </div>
        </section>
      </div>
    </div>
  );
};