
import React, { useState, useRef, useEffect } from 'react';
import { Project, ProjectRole } from '../types';
import { 
  ArrowLeft, Trash2, Save, LayoutTemplate, Palette, 
  Users, Plug2, AlertTriangle, ShieldAlert, Upload, Image as ImageIcon, Link,
  Layers, Plus, X, Mail, Shield, ShieldCheck, Eye, Clock, Check, LogOut, UserCheck, Crown, AtSign, Search, Loader2, FolderGit2, Github, Building2, User
} from 'lucide-react';
import { iconMap, ProjectIconDisplay } from './Layout';
import { auth, findUserByEmail, searchUsersByNickname } from '../services/auth';
import { sendInvite, saveProject } from '../services/firebase';

interface ProjectSettingsProps {
  project: Project;
  onUpdateProject: (p: Project) => void;
  onDeleteProject: (id: string) => void;
  onLeaveProject: () => void;
  onBack: () => void;
}

type SettingsTab = 'general' | 'architecture' | 'team' | 'repos' | 'integrations' | 'danger';
type RepoFilter = 'all' | 'owner' | 'organization';

export const ProjectSettings: React.FC<ProjectSettingsProps> = ({ 
  project, 
  onUpdateProject, 
  onDeleteProject, 
  onLeaveProject,
  onBack 
}) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const [formData, setFormData] = useState({
    name: project.name,
    description: project.description,
    icon: project.icon,
    subsystems: project.subsystems || ['Frontend', 'Backend'],
    roles: project.roles || ['Admin', 'User']
  });
  
  const [newSubsystem, setNewSubsystem] = useState('');
  const [newRole, setNewRole] = useState('');
  
  // Team Invite State
  const [searchNick, setSearchNick] = useState('');
  const [inviteRole, setInviteRole] = useState<ProjectRole>('editor');
  const [isInviting, setIsInviting] = useState(false);
  const [foundUsers, setFoundUsers] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  // GitHub Repos State
  const [newRepoUrl, setNewRepoUrl] = useState('');
  const [githubReposList, setGithubReposList] = useState<any[]>([]);
  const [isLoadingGithub, setIsLoadingGithub] = useState(false);
  const [repoSearch, setRepoSearch] = useState('');
  const [showGithubList, setShowGithubList] = useState(false);
  const [repoFilter, setRepoFilter] = useState<RepoFilter>('all');
  
  // Toast Notification State
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error', visible: boolean }>({
      message: '', type: 'success', visible: false
  });
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const currentUser = auth.currentUser;
  const isOwner = currentUser?.uid === project.ownerId;

  // Auto-hide toast
  useEffect(() => {
      if (toast.visible) {
          const timer = setTimeout(() => setToast(prev => ({ ...prev, visible: false })), 3000);
          return () => clearTimeout(timer);
      }
  }, [toast.visible]);

  // Debounced Search for Nickname
  useEffect(() => {
      if (!searchNick.trim() || selectedUser) {
          setFoundUsers([]);
          return;
      }

      const timer = setTimeout(async () => {
          setIsSearching(true);
          const results = await searchUsersByNickname(searchNick);
          // Filter out existing active members
          const filtered = results.filter(u => {
              const isMember = project.team?.some(m => m.email === u.email && m.status === 'active');
              return !isMember;
          });
          setFoundUsers(filtered);
          setIsSearching(false);
      }, 500);

      return () => clearTimeout(timer);
  }, [searchNick, project.team, selectedUser]);

  const showToast = (message: string, type: 'success' | 'error') => {
      setToast({ message, type, visible: true });
  };

  // Se o project.team não estiver inicializado (projetos antigos), inicializa na view
  const teamMembers = project.team || (project.members || []).map(email => ({
      email,
      nickname: '', // Fallback
      role: 'editor' as ProjectRole,
      status: 'active' as const,
      addedAt: Date.now()
  }));

  const activeMembers = teamMembers.filter(m => m.status === 'active');
  const pendingMembers = teamMembers.filter(m => m.status === 'pending');
  const removedMembers = teamMembers.filter(m => m.status === 'removed');

  const handleSave = () => {
    onUpdateProject({
      ...project,
      name: formData.name,
      description: formData.description,
      icon: formData.icon,
      subsystems: formData.subsystems,
      roles: formData.roles
    });
    showToast("Projeto atualizado com sucesso!", 'success');
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_SIZE = 256;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_SIZE) {
              height *= MAX_SIZE / width;
              width = MAX_SIZE;
            }
          } else {
            if (height > MAX_SIZE) {
              width *= MAX_SIZE / height;
              height = MAX_SIZE;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          
          const base64 = canvas.toDataURL('image/png');
          setFormData(prev => ({ ...prev, icon: base64 }));
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  // Tag Management Logic
  const addSubsystem = () => {
    if (newSubsystem.trim() && !formData.subsystems.includes(newSubsystem.trim())) {
      setFormData(prev => ({ ...prev, subsystems: [...prev.subsystems, newSubsystem.trim()] }));
      setNewSubsystem('');
    }
  };
  const removeSubsystem = (tag: string) => {
    setFormData(prev => ({ ...prev, subsystems: prev.subsystems.filter(s => s !== tag) }));
  };

  const addRole = () => {
    if (newRole.trim() && !formData.roles.includes(newRole.trim())) {
      setFormData(prev => ({ ...prev, roles: [...prev.roles, newRole.trim()] }));
      setNewRole('');
    }
  };
  const removeRole = (tag: string) => {
    setFormData(prev => ({ ...prev, roles: prev.roles.filter(r => r !== tag) }));
  };

  // Team Logic
  const handleInvite = async () => {
    if (!selectedUser) {
        showToast("Selecione um usuário da lista para convidar.", 'error');
        return;
    }
    
    // Check if already active (redundant check, but safe)
    if (activeMembers.find(m => m.email === selectedUser.email)) {
        showToast("Este usuário já faz parte do projeto.", 'error');
        return;
    }

    setIsInviting(true);
    try {
        await sendInvite(
            currentUser?.email || '', 
            selectedUser.email, 
            project.id, 
            project.name, 
            inviteRole,
            selectedUser.nickname
        );
        
        // Simulação otimista para UI
        const newMember = { 
            email: selectedUser.email, 
            nickname: selectedUser.nickname,
            role: inviteRole, 
            status: 'pending', 
            addedAt: Date.now() 
        };
        
        // Remove se ja existia (ex-membro) e adiciona pending
        const updatedTeam: any = [...teamMembers.filter(m => m.email !== selectedUser.email), newMember]; 
        
        onUpdateProject({ ...project, team: updatedTeam });

        showToast(`Convite enviado para @${selectedUser.nickname}.`, 'success');
        setSearchNick('');
        setSelectedUser(null);
        setFoundUsers([]);
    } catch (error) {
        showToast("Erro ao enviar convite.", 'error');
    } finally {
        setIsInviting(false);
    }
  };

  const updateMemberRole = (email: string, newRole: ProjectRole) => {
      const updatedTeam = teamMembers.map(m => m.email === email ? { ...m, role: newRole } : m);
      onUpdateProject({ ...project, team: updatedTeam });
      showToast("Permissão atualizada.", 'success');
  };

  const removeMember = (email: string, hardDelete: boolean = false) => {
      if (!isOwner) return;
      
      const confirmMsg = hardDelete 
        ? `Excluir convite/membro permanentemente?` 
        : `Remover acesso? Ele poderá ser restaurado depois.`;

      if (confirm(confirmMsg)) {
          let updatedTeam;
          if (hardDelete) {
              updatedTeam = teamMembers.filter(m => m.email !== email);
          } else {
              updatedTeam = teamMembers.map(m => m.email === email ? { ...m, status: 'removed' as const } : m);
          }
          
          // Update search index members list
          const updatedMembers = (project.members || []).filter(e => e !== email);
          
          onUpdateProject({ ...project, team: updatedTeam, members: updatedMembers });
          showToast(hardDelete ? "Removido com sucesso." : "Acesso removido.", 'success');
      }
  };

  const restoreMember = (member: any) => {
      const updatedTeam = teamMembers.map(m => m.email === member.email ? { ...m, status: 'active' as const } : m);
      const updatedMembers = [...(project.members || []), member.email];
      onUpdateProject({ ...project, team: updatedTeam, members: updatedMembers });
      showToast("Membro restaurado.", 'success');
  };

  const handleTransferOwnership = async (newOwnerEmail: string) => {
      if (!confirm(`ATENÇÃO: Você está prestes a transferir a propriedade do projeto.\n\nVocê perderá o status de Dono e se tornará um Administrador.\nDeseja continuar?`)) {
          return;
      }

      try {
          // Busca UID real do usuário no banco
          const targetUser = await findUserByEmail(newOwnerEmail);
          
          if (!targetUser) {
              showToast("Usuário não encontrado na plataforma. Ele precisa ter uma conta no Nexion.", 'error');
              return;
          }

          // Atualiza lista de membros (garante que novo dono é admin)
          const updatedTeam = teamMembers.map(m => {
              if (m.email === newOwnerEmail) return { ...m, role: 'admin' as ProjectRole };
              if (m.email === currentUser?.email) return { ...m, role: 'admin' as ProjectRole };
              return m;
          });

          // Atualiza projeto com novo ownerId
          onUpdateProject({
              ...project,
              ownerId: targetUser.uid,
              team: updatedTeam
          });

          showToast("Propriedade transferida com sucesso!", 'success');
      } catch (e) {
          console.error(e);
          showToast("Erro ao transferir propriedade.", 'error');
      }
  };

  // --- REPO HANDLERS ---
  const fetchGithubRepos = async () => {
      if (!currentUser?.githubToken) {
          showToast("Login com GitHub não detectado.", 'error');
          return;
      }

      setIsLoadingGithub(true);
      setShowGithubList(true);
      try {
          // Fetch user repos using visibility=all and affiliation parameters
          // This ensures we get everything (private, orgs, etc) if the token allows it
          const response = await fetch('https://api.github.com/user/repos?per_page=100&sort=updated&visibility=all&affiliation=owner,collaborator,organization_member', {
              headers: {
                  Authorization: `Bearer ${currentUser.githubToken}`,
                  Accept: 'application/vnd.github.v3+json'
              }
          });

          if (!response.ok) {
              if (response.status === 401) {
                  throw new Error("Sessão do GitHub expirou. Faça login novamente.");
              }
              throw new Error("Falha ao buscar repositórios.");
          }

          const data = await response.json();
          setGithubReposList(data);
      } catch (error: any) {
          console.error(error);
          showToast(error.message, 'error');
      } finally {
          setIsLoadingGithub(false);
      }
  };

  const handleConnectFetchedRepo = (repoHtmlUrl: string) => {
      const currentRepos = project.githubRepos || [];
      if (currentRepos.includes(repoHtmlUrl)) {
          showToast("Repositório já conectado.", 'error');
          return;
      }
      onUpdateProject({ ...project, githubRepos: [...currentRepos, repoHtmlUrl] });
      showToast("Conectado!", 'success');
  };

  const handleAddRepo = () => {
      if (!newRepoUrl.trim()) return;
      let cleanUrl = newRepoUrl.trim();
      
      // Basic clean up: if user just pastes "owner/repo", prepend github.com
      if (!cleanUrl.startsWith('http') && !cleanUrl.includes('github.com')) {
          cleanUrl = `https://github.com/${cleanUrl}`;
      }

      const currentRepos = project.githubRepos || [];
      if (currentRepos.includes(cleanUrl)) {
          showToast("Este repositório já está conectado.", 'error');
          return;
      }

      onUpdateProject({ ...project, githubRepos: [...currentRepos, cleanUrl] });
      setNewRepoUrl('');
      showToast("Repositório conectado!", 'success');
  };

  const handleRemoveRepo = (repoUrl: string) => {
      if(confirm("Desconectar este repositório?")) {
          const currentRepos = project.githubRepos || [];
          onUpdateProject({ ...project, githubRepos: currentRepos.filter(r => r !== repoUrl) });
          showToast("Repositório removido.", 'success');
      }
  };

  const renderTabButton = (id: SettingsTab, label: string, icon: React.ElementType) => {
    const Icon = icon;
    return (
      <button
        onClick={() => setActiveTab(id)}
        className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
          activeTab === id 
            ? 'border-primary-500 text-primary-400' 
            : 'border-transparent text-base-muted hover:text-base-text hover:bg-base-800/50'
        }`}
      >
        <Icon size={16} />
        {label}
      </button>
    );
  };

  const filteredGithubRepos = githubReposList.filter(r => {
      const matchesSearch = r.full_name.toLowerCase().includes(repoSearch.toLowerCase());
      const matchesFilter = repoFilter === 'all' 
          ? true 
          : repoFilter === 'owner' 
              ? r.owner.type === 'User' 
              : r.owner.type === 'Organization';
      return matchesSearch && matchesFilter;
  });

  return (
    <div className="flex flex-col bg-base-900 text-base-text min-h-full relative">
      {/* Toast Notification (Bottom Right) */}
      <div className={`fixed bottom-6 right-6 z-[100] transition-all duration-300 transform ${toast.visible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0 pointer-events-none'}`}>
          <div className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-2xl border backdrop-blur-md ${
              toast.type === 'success' 
                ? 'bg-green-900/90 border-green-500/50 text-white shadow-green-900/20' 
                : 'bg-red-900/90 border-red-500/50 text-white shadow-red-900/20'
          }`}>
              {toast.type === 'success' ? <Check size={18} className="text-green-300" /> : <AlertTriangle size={18} className="text-red-300" />}
              <span className="text-sm font-medium">{toast.message}</span>
              <button onClick={() => setToast(prev => ({...prev, visible: false}))} className="ml-2 hover:bg-white/20 p-1 rounded-full"><X size={14} /></button>
          </div>
      </div>

      {/* Header - Sticky */}
      <div className="h-16 border-b border-base-800 flex items-center px-6 bg-base-950 gap-4 flex-shrink-0 sticky top-0 z-30">
        <button onClick={onBack} className="p-2 hover:bg-base-800 rounded-full transition-colors text-base-muted hover:text-base-text">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-bold">Configurações do Projeto: {project.name}</h1>
      </div>

      {/* Tabs - Sticky */}
      <div className="flex items-center px-6 border-b border-base-800 bg-base-900 flex-shrink-0 overflow-x-auto sticky top-16 z-20">
        {renderTabButton('general', 'Geral', LayoutTemplate)}
        {renderTabButton('architecture', 'Arquitetura', Layers)}
        {renderTabButton('team', 'Equipe', Users)}
        {renderTabButton('repos', 'Repositórios', FolderGit2)}
        {renderTabButton('integrations', 'Integrações', Plug2)}
        {renderTabButton('danger', 'Avançado', ShieldAlert)}
      </div>

      <div className="flex-1 w-full">
        <div className="p-8 max-w-4xl mx-auto w-full">
        
          {/* TAB: GENERAL */}
          {activeTab === 'general' && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
              <section className="mb-10">
                <h2 className="text-lg font-semibold mb-6 flex items-center gap-2">
                  <LayoutTemplate size={20} className="text-primary-500" />
                  Informações Principais
                </h2>

                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-base-muted mb-2">Nome do Projeto</label>
                    <input 
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      className="w-full bg-base-800 border border-base-700 rounded-lg p-3 text-base-text focus:border-primary-500 focus:outline-none transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-base-muted mb-2">Descrição</label>
                    <textarea 
                      value={formData.description}
                      onChange={(e) => setFormData({...formData, description: e.target.value})}
                      rows={4}
                      className="w-full bg-base-800 border border-base-700 rounded-lg p-3 text-base-text focus:border-primary-500 focus:outline-none transition-colors resize-none"
                    />
                  </div>
                </div>
              </section>

              <section className="mb-10">
                <h2 className="text-lg font-semibold mb-6 flex items-center gap-2">
                  <Palette size={20} className="text-primary-500" />
                  Identidade Visual
                </h2>
                
                <div className="bg-base-800 border border-base-700 rounded-xl p-6">
                  <div className="flex items-center gap-6 mb-6">
                      <div className="w-20 h-20 bg-base-700 rounded-xl flex items-center justify-center text-primary-400 shadow-inner overflow-hidden border border-base-600 flex-shrink-0">
                          <ProjectIconDisplay icon={formData.icon} size={40} />
                      </div>
                      <div className="flex-1 w-full">
                          <p className="font-medium mb-1">Ícone Personalizado</p>
                          <p className="text-sm text-base-muted mb-3">Escolha um ícone da lista abaixo, envie uma imagem ou cole um link.</p>
                          
                          <div className="flex flex-col sm:flex-row gap-2 w-full">
                            <button 
                              onClick={() => fileInputRef.current?.click()}
                              className="flex items-center gap-2 bg-base-700 hover:bg-base-600 text-base-text px-3 py-2 rounded-lg text-sm transition-colors border border-base-600 whitespace-nowrap justify-center"
                            >
                              <Upload size={14} /> Carregar Imagem
                            </button>
                            <input 
                              type="file" 
                              ref={fileInputRef} 
                              className="hidden" 
                              accept="image/*"
                              onChange={handleImageUpload}
                            />
                            
                            <div className="flex-1 flex items-center bg-base-900 border border-base-700 rounded-lg px-3 overflow-hidden focus-within:border-primary-500 transition-colors">
                                <Link size={14} className="text-base-muted flex-shrink-0 mr-2" />
                                <input 
                                    type="text" 
                                    placeholder="Ou cole URL da imagem..." 
                                    className="w-full bg-transparent border-none text-sm text-base-text focus:outline-none py-2"
                                    onChange={(e) => setFormData({...formData, icon: e.target.value})}
                                    value={formData.icon?.startsWith('http') ? formData.icon : ''}
                                />
                            </div>
                          </div>
                      </div>
                  </div>

                  <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 gap-2">
                      {Object.keys(iconMap).map(iconKey => {
                          const Icon = iconMap[iconKey];
                          return (
                              <button
                                  key={iconKey}
                                  onClick={() => setFormData({...formData, icon: iconKey})}
                                  className={`p-2 rounded-lg flex items-center justify-center transition-all ${
                                      formData.icon === iconKey 
                                          ? 'bg-primary-500 text-white scale-110 shadow-lg' 
                                          : 'text-base-muted hover:bg-base-900 hover:text-base-text'
                                  }`}
                                  title={iconKey}
                              >
                                  <Icon size={20} />
                              </button>
                          )
                      })}
                  </div>
                </div>
              </section>

              <div className="flex justify-end pt-6 border-t border-base-800">
                <button 
                    onClick={handleSave}
                    className="flex items-center gap-2 bg-primary-600 hover:bg-primary-500 text-white px-6 py-2 rounded-lg font-medium shadow-lg shadow-primary-900/20 transition-all"
                >
                    <Save size={18} /> Salvar Alterações
                </button>
              </div>
            </div>
          )}

          {/* ... OTHER TABS (Architecture, Team) ... */}
          {/* TAB: ARCHITECTURE */}
          {activeTab === 'architecture' && (
             <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="mb-8">
                  <h2 className="text-lg font-semibold mb-2 flex items-center gap-2">
                     <Layers size={20} className="text-primary-500" /> 
                     Estrutura & Atores
                  </h2>
                  <p className="text-base-muted text-sm">
                    Defina os módulos do sistema (ex: Backend, Frontend) e os tipos de usuário (ex: Admin, Cliente) para organizar melhor suas tarefas e documentos.
                  </p>
               </div>

               <div className="grid md:grid-cols-2 gap-8">
                  {/* SUBSYSTEMS */}
                  <div className="bg-base-800 border border-base-700 rounded-xl p-6">
                    <h3 className="font-semibold text-base-text mb-4">Sub-sistemas (Módulos)</h3>
                    <div className="flex gap-2 mb-4">
                       <input 
                         type="text"
                         value={newSubsystem}
                         onChange={(e) => setNewSubsystem(e.target.value)}
                         onKeyDown={(e) => e.key === 'Enter' && addSubsystem()}
                         placeholder="Ex: API Gateway"
                         className="flex-1 bg-base-900 border border-base-700 rounded-lg px-3 py-2 text-sm focus:border-primary-500 outline-none"
                       />
                       <button onClick={addSubsystem} className="bg-base-700 hover:bg-base-600 p-2 rounded-lg transition-colors">
                          <Plus size={18} />
                       </button>
                    </div>
                    
                    <div className="flex flex-wrap gap-2">
                       {formData.subsystems.map(tag => (
                          <span key={tag} className="bg-primary-500/10 text-primary-400 border border-primary-500/20 px-3 py-1 rounded-full text-sm flex items-center gap-2">
                             {tag}
                             <button onClick={() => removeSubsystem(tag)} className="hover:text-red-400">
                                <X size={12} />
                             </button>
                          </span>
                       ))}
                       {formData.subsystems.length === 0 && (
                          <span className="text-base-muted text-xs italic">Nenhum módulo definido.</span>
                       )}
                    </div>
                  </div>

                  {/* ROLES */}
                  <div className="bg-base-800 border border-base-700 rounded-xl p-6">
                    <h3 className="font-semibold text-base-text mb-4">Atores (Tipos de Usuário)</h3>
                    <div className="flex gap-2 mb-4">
                       <input 
                         type="text"
                         value={newRole}
                         onChange={(e) => setNewRole(e.target.value)}
                         onKeyDown={(e) => e.key === 'Enter' && addRole()}
                         placeholder="Ex: Administrador"
                         className="flex-1 bg-base-900 border border-base-700 rounded-lg px-3 py-2 text-sm focus:border-primary-500 outline-none"
                       />
                       <button onClick={addRole} className="bg-base-700 hover:bg-base-600 p-2 rounded-lg transition-colors">
                          <Plus size={18} />
                       </button>
                    </div>
                    
                    <div className="flex flex-wrap gap-2">
                       {formData.roles.map(tag => (
                          <span key={tag} className="bg-blue-500/10 text-blue-400 border border-blue-500/20 px-3 py-1 rounded-full text-sm flex items-center gap-2">
                             {tag}
                             <button onClick={() => removeRole(tag)} className="hover:text-red-400">
                                <X size={12} />
                             </button>
                          </span>
                       ))}
                       {formData.roles.length === 0 && (
                          <span className="text-base-muted text-xs italic">Nenhum ator definido.</span>
                       )}
                    </div>
                  </div>
               </div>
               
                <div className="flex justify-end pt-6 border-t border-base-800 mt-8">
                    <button 
                        onClick={handleSave}
                        className="flex items-center gap-2 bg-primary-600 hover:bg-primary-500 text-white px-6 py-2 rounded-lg font-medium shadow-lg shadow-primary-900/20 transition-all"
                    >
                        <Save size={18} /> Salvar Estrutura
                    </button>
                </div>
             </div>
          )}

          {/* TAB: REPOS (Enhanced with GitHub API & Filtering) */}
          {activeTab === 'repos' && (
             <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="mb-8">
                  <h2 className="text-lg font-semibold mb-2 flex items-center gap-2">
                     <FolderGit2 size={20} className="text-primary-500" /> 
                     Repositórios Conectados
                  </h2>
                  <p className="text-base-muted text-sm">
                    Vincule repositórios do GitHub para facilitar o acesso e futuras integrações.
                  </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                    {/* Manual Input */}
                    <div className="bg-base-800 border border-base-700 rounded-xl p-6">
                        <h3 className="font-semibold text-base-text mb-4 text-sm uppercase tracking-wider">Adicionar Manualmente</h3>
                        <label className="block text-sm font-medium text-base-muted mb-2">URL do Repositório</label>
                        <div className="flex gap-2">
                           <div className="flex-1 relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-base-muted"><Link size={16}/></span>
                              <input 
                                type="text" 
                                placeholder="https://github.com/owner/repo" 
                                value={newRepoUrl}
                                onChange={(e) => setNewRepoUrl(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleAddRepo()}
                                className="w-full bg-base-900 border border-base-700 rounded-lg pl-10 pr-3 py-2 text-sm focus:border-primary-500 outline-none transition-colors"
                              />
                           </div>
                           <button 
                             onClick={handleAddRepo}
                             disabled={!newRepoUrl.trim()}
                             className="bg-base-700 hover:bg-base-600 text-base-text px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                           >
                             Adicionar
                           </button>
                        </div>
                    </div>

                    {/* GitHub API Fetch */}
                    <div className="bg-base-800 border border-base-700 rounded-xl p-6">
                        <h3 className="font-semibold text-base-text mb-4 text-sm uppercase tracking-wider flex items-center gap-2">
                            <Github size={16} /> Importar do GitHub
                        </h3>
                        {!currentUser?.githubToken ? (
                            <div className="text-center py-4 bg-base-900/50 rounded-lg border border-base-700/50">
                                <p className="text-sm text-base-muted mb-3">Você não está logado com GitHub.</p>
                                <p className="text-xs text-base-muted opacity-70">Para listar seus repositórios, faça login usando sua conta GitHub na tela inicial.</p>
                            </div>
                        ) : (
                            <div>
                                {!showGithubList ? (
                                    <button 
                                        onClick={fetchGithubRepos}
                                        disabled={isLoadingGithub}
                                        className="w-full flex items-center justify-center gap-2 bg-[#24292e] hover:bg-[#2f363d] text-white py-2.5 rounded-lg font-medium transition-colors text-sm border border-white/10"
                                    >
                                        {isLoadingGithub ? <Loader2 className="animate-spin" size={16} /> : <Github size={16} />}
                                        Listar meus Repositórios
                                    </button>
                                ) : (
                                    <div className="animate-in fade-in duration-300">
                                        <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
                                            <button 
                                                onClick={() => setRepoFilter('all')}
                                                className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors border ${repoFilter === 'all' ? 'bg-primary-600 text-white border-primary-500' : 'bg-base-900 text-base-muted border-base-700 hover:text-base-text'}`}
                                            >
                                                Todos
                                            </button>
                                            <button 
                                                onClick={() => setRepoFilter('owner')}
                                                className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors border flex items-center gap-1 ${repoFilter === 'owner' ? 'bg-primary-600 text-white border-primary-500' : 'bg-base-900 text-base-muted border-base-700 hover:text-base-text'}`}
                                            >
                                                <User size={12} /> Pessoais
                                            </button>
                                            <button 
                                                onClick={() => setRepoFilter('organization')}
                                                className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors border flex items-center gap-1 ${repoFilter === 'organization' ? 'bg-primary-600 text-white border-primary-500' : 'bg-base-900 text-base-muted border-base-700 hover:text-base-text'}`}
                                            >
                                                <Building2 size={12} /> Organizações
                                            </button>
                                        </div>

                                        <div className="relative mb-3">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-base-muted" size={14} />
                                            <input 
                                                type="text" 
                                                placeholder="Filtrar por nome..." 
                                                value={repoSearch}
                                                onChange={(e) => setRepoSearch(e.target.value)}
                                                className="w-full bg-base-900 border border-base-700 rounded-lg pl-9 pr-3 py-2 text-xs focus:border-primary-500 outline-none"
                                                autoFocus
                                            />
                                        </div>
                                        <div className="max-h-48 overflow-y-auto custom-scrollbar border border-base-700 rounded-lg bg-base-900">
                                            {filteredGithubRepos.length === 0 ? (
                                                <p className="p-3 text-xs text-base-muted text-center">Nenhum repositório encontrado.</p>
                                            ) : (
                                                <div className="divide-y divide-base-800">
                                                    {filteredGithubRepos.map((repo) => {
                                                        const isAdded = (project.githubRepos || []).includes(repo.html_url);
                                                        const isOrg = repo.owner.type === 'Organization';
                                                        return (
                                                            <div key={repo.id} className="flex items-center justify-between p-3 hover:bg-base-800 transition-colors">
                                                                <div className="min-w-0 flex-1 pr-2">
                                                                    <div className="flex items-center gap-2">
                                                                        {isOrg ? <Building2 size={12} className="text-base-muted" /> : <User size={12} className="text-base-muted" />}
                                                                        <p className="text-sm font-medium text-base-text truncate">{repo.full_name}</p>
                                                                    </div>
                                                                    <p className="text-[10px] text-base-muted flex gap-2 ml-5">
                                                                        <span>{repo.private ? '🔒 Privado' : 'Publico'}</span>
                                                                        <span>•</span>
                                                                        <span>⭐ {repo.stargazers_count}</span>
                                                                    </p>
                                                                </div>
                                                                <button 
                                                                    onClick={() => handleConnectFetchedRepo(repo.html_url)}
                                                                    disabled={isAdded}
                                                                    className={`text-xs px-2 py-1 rounded border transition-colors ${
                                                                        isAdded 
                                                                            ? 'border-green-500/30 text-green-400 bg-green-500/10 cursor-default' 
                                                                            : 'border-base-600 hover:border-primary-500 text-base-muted hover:text-primary-400'
                                                                    }`}
                                                                >
                                                                    {isAdded ? 'Adicionado' : 'Conectar'}
                                                                </button>
                                                            </div>
                                                        )
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                        <button 
                                            onClick={() => setShowGithubList(false)}
                                            className="w-full mt-2 text-xs text-base-muted hover:text-base-text py-1"
                                        >
                                            Fechar Lista
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                <div className="space-y-3">
                    <h3 className="text-xs font-bold text-base-muted uppercase tracking-wider mb-2">Conectados ({project.githubRepos?.length || 0})</h3>
                    
                    {(project.githubRepos || []).length === 0 ? (
                        <div className="text-center py-8 border-2 border-dashed border-base-800 rounded-xl">
                            <FolderGit2 className="mx-auto text-base-700 mb-2" size={32} />
                            <p className="text-base-muted text-sm">Nenhum repositório conectado.</p>
                        </div>
                    ) : (
                        (project.githubRepos || []).map(repo => (
                            <div key={repo} className="flex items-center justify-between p-4 bg-base-800/50 border border-base-700 rounded-lg group">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-base-900 rounded-md border border-base-800">
                                        <FolderGit2 size={18} className="text-base-text" />
                                    </div>
                                    <a href={repo} target="_blank" rel="noreferrer" className="text-sm font-medium text-primary-400 hover:underline truncate">
                                        {repo.replace('https://github.com/', '')}
                                    </a>
                                </div>
                                <button 
                                    onClick={() => handleRemoveRepo(repo)}
                                    className="p-2 text-base-muted hover:text-red-400 hover:bg-red-900/10 rounded transition-colors opacity-0 group-hover:opacity-100"
                                    title="Desconectar"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        ))
                    )}
                </div>
             </div>
          )}

          {/* TAB: TEAM */}
          {activeTab === 'team' && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-10">
              <div className="flex flex-col gap-2">
                  <h2 className="text-lg font-semibold flex items-center gap-2">
                      <Users size={20} className="text-primary-500" />
                      Gerenciar Acesso
                  </h2>
                  <p className="text-base-muted text-sm">Pesquise pelo Nickname do usuário para convidar.</p>
              </div>

              {/* Invite Box (Redesigned for Nickname Search) */}
              <div className="bg-base-800 border border-base-700 rounded-xl p-6 shadow-sm relative">
                  <label className="block text-sm font-medium text-base-text mb-3">Convidar por Nickname</label>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="flex-1 relative">
                        <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 text-base-muted" size={16} />
                        <input 
                            type="text" 
                            placeholder="Buscar nick (ex: dev_ninja)" 
                            value={selectedUser ? selectedUser.nickname : searchNick}
                            onChange={(e) => {
                                setSearchNick(e.target.value);
                                setSelectedUser(null);
                            }}
                            className={`w-full bg-base-900 border border-base-700 rounded-lg pl-10 pr-10 py-2.5 text-base-text focus:border-primary-500 outline-none transition-colors ${selectedUser ? 'border-primary-500 text-primary-400 font-medium' : ''}`}
                        />
                        {isSearching && (
                            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 text-base-muted animate-spin" size={16} />
                        )}
                        {selectedUser && (
                            <button 
                                onClick={() => { setSelectedUser(null); setSearchNick(''); }}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-base-muted hover:text-red-400"
                            >
                                <X size={16} />
                            </button>
                        )}

                        {/* Search Dropdown */}
                        {!selectedUser && foundUsers.length > 0 && (
                            <div className="absolute top-full left-0 right-0 mt-2 bg-base-800 border border-base-700 rounded-lg shadow-xl z-20 overflow-hidden max-h-60 overflow-y-auto">
                                {foundUsers.map(user => (
                                    <button 
                                        key={user.uid}
                                        onClick={() => {
                                            setSelectedUser(user);
                                            setSearchNick(user.nickname);
                                            setFoundUsers([]);
                                        }}
                                        className="w-full text-left px-4 py-3 hover:bg-base-700 flex items-center gap-3 transition-colors border-b border-base-700/50 last:border-0"
                                    >
                                        <div className="w-8 h-8 rounded-full bg-base-900 flex items-center justify-center text-xs font-bold text-base-muted">
                                            {user.nickname.substring(0,2).toUpperCase()}
                                        </div>
                                        <div>
                                            <p className="font-medium text-sm text-base-text">{user.displayName || 'Sem nome'}</p>
                                            <p className="text-xs text-base-muted">@{user.nickname}</p>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="relative w-full sm:w-48">
                        <select 
                            value={inviteRole}
                            onChange={(e) => setInviteRole(e.target.value as ProjectRole)}
                            className="w-full bg-base-900 border border-base-700 rounded-lg pl-3 pr-8 py-2.5 text-base-text focus:border-primary-500 outline-none appearance-none cursor-pointer"
                        >
                            <option value="admin">Administrador</option>
                            <option value="editor">Colaborador</option>
                            <option value="viewer">Leitor</option>
                        </select>
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-base-muted">
                            <Shield size={14} />
                        </div>
                    </div>
                    <button 
                        onClick={handleInvite}
                        disabled={isInviting || !selectedUser}
                        className="bg-primary-600 hover:bg-primary-500 text-white px-6 py-2.5 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 whitespace-nowrap shadow-lg shadow-primary-900/20"
                    >
                      {isInviting ? "Enviando..." : <> <Plus size={16} /> Convidar</>}
                    </button>
                  </div>
              </div>

              {/* ACTIVE MEMBERS LIST */}
              <div>
                  <h3 className="text-xs font-bold text-base-muted uppercase tracking-wider mb-4 flex items-center gap-2 border-b border-base-800 pb-2">
                      <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]"></div>
                      Membros Ativos ({activeMembers.length})
                  </h3>
                  <div className="space-y-3">
                      {activeMembers.map(member => {
                          const isMe = member.email === currentUser?.email;
                          const showOwnerBadge = project.ownerId === currentUser?.uid && isMe;
                          
                          return (
                            <div key={member.email} className={`flex items-center justify-between p-4 bg-base-800/50 border border-base-700/50 rounded-lg group hover:border-base-600 transition-all ${isMe ? 'bg-base-800 border-primary-500/20' : ''}`}>
                                <div className="flex items-center gap-4">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${
                                        showOwnerBadge ? 'bg-amber-500 text-white shadow-lg shadow-amber-900/20' : 'bg-base-700 text-base-300'
                                    }`}>
                                        {showOwnerBadge ? <Crown size={18} /> : (member.nickname || member.email).substring(0,2).toUpperCase()}
                                    </div>
                                    <div>
                                        <p className="font-medium text-base-text flex items-center gap-2">
                                            {member.nickname ? `@${member.nickname}` : member.email}
                                        </p>
                                        {/* "Você" Tag moved below name */}
                                        {isMe && <span className="text-[10px] bg-primary-500/20 text-primary-300 px-1.5 py-0.5 rounded border border-primary-500/30 inline-block mt-1">Você</span>}
                                        
                                        <div className="flex items-center gap-2 mt-1">
                                            {showOwnerBadge ? (
                                                <span className="text-[10px] font-bold uppercase tracking-wide text-amber-400 flex items-center gap-1">
                                                    <Crown size={10} /> Dono do Projeto
                                                </span>
                                            ) : (
                                                /* If NOT me, show role badge here on the left side */
                                                !isMe && (
                                                    <span className={`text-xs px-2 py-0.5 rounded border capitalize ${
                                                        member.role === 'admin' 
                                                            ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' 
                                                            : 'bg-base-700/50 text-base-400 border-base-600'
                                                    }`}>
                                                        {member.role === 'admin' ? 'Administrador' : member.role === 'editor' ? 'Colaborador' : 'Leitor'}
                                                    </span>
                                                )
                                            )}
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="flex items-center gap-2">
                                    {/* Owner Control Actions */}
                                    {isOwner && !isMe && (
                                        <>
                                            <div className="relative">
                                                <select 
                                                    value={member.role}
                                                    onChange={(e) => {
                                                        if (e.target.value === 'transfer_owner') {
                                                            handleTransferOwnership(member.email);
                                                        } else {
                                                            updateMemberRole(member.email, e.target.value as ProjectRole)
                                                        }
                                                    }}
                                                    className="bg-base-900 border border-base-700 text-xs rounded-md px-3 py-1.5 text-base-muted focus:text-base-text outline-none pr-8 cursor-pointer hover:border-base-500 transition-colors"
                                                >
                                                    <option value="admin">Admin</option>
                                                    <option value="editor">Colaborador</option>
                                                    <option value="viewer">Leitor</option>
                                                    <option disabled>──────────</option>
                                                    <option value="transfer_owner">👑 Tornar Dono</option>
                                                </select>
                                                <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-base-muted">
                                                    <Shield size={10} />
                                                </div>
                                            </div>

                                            <button 
                                                onClick={() => removeMember(member.email)}
                                                className="text-xs text-red-400 hover:bg-red-900/20 px-3 py-1.5 rounded-md transition-colors font-medium border border-transparent hover:border-red-900/30"
                                            >
                                                Remover
                                            </button>
                                        </>
                                    )}
                                    
                                    {/* Non-Owner View / Self View */}
                                    {(!isOwner || isMe) && (
                                        <div className="text-xs text-base-muted px-2">
                                            {/* If IS me and NOT owner, show badge here instead of text */}
                                            {isMe && !showOwnerBadge ? (
                                                <span className={`text-xs px-2 py-0.5 rounded border capitalize ${
                                                    member.role === 'admin' 
                                                        ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' 
                                                        : 'bg-base-700/50 text-base-400 border-base-600'
                                                }`}>
                                                    {member.role === 'admin' ? 'Administrador' : member.role === 'editor' ? 'Colaborador' : 'Leitor'}
                                                </span>
                                            ) : (
                                                !isOwner && "" // Empty string for others view if I am not owner
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                          );
                      })}
                  </div>
              </div>

              {/* PENDING INVITES LIST */}
              {pendingMembers.length > 0 && (
                  <div className="animate-in fade-in duration-300">
                      <h3 className="text-xs font-bold text-base-muted uppercase tracking-wider mb-4 flex items-center gap-2 border-b border-base-800 pb-2">
                          <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></div>
                          Convites Pendentes ({pendingMembers.length})
                      </h3>
                      <div className="space-y-3">
                          {pendingMembers.map(member => (
                              <div key={member.email} className="flex items-center justify-between p-4 bg-base-900 border border-base-800 border-dashed rounded-lg">
                                  <div className="flex items-center gap-3">
                                      <div className="w-10 h-10 rounded-full bg-base-800 text-base-600 flex items-center justify-center font-bold border border-base-700">
                                          <Clock size={16} />
                                      </div>
                                      <div>
                                          <p className="font-medium text-base-muted flex items-center gap-2">
                                              {member.nickname ? `@${member.nickname}` : member.email}
                                          </p>
                                          <p className="text-xs text-base-muted/70">
                                              Aguardando aceitação • {new Date(member.addedAt).toLocaleDateString()}
                                          </p>
                                      </div>
                                  </div>
                                  
                                  {isOwner && (
                                      <button 
                                          onClick={() => removeMember(member.email, true)} // Hard delete removes from pending
                                          className="text-xs text-base-muted hover:text-red-400 px-3 py-1.5 rounded-md transition-colors flex items-center gap-1 hover:bg-base-800 border border-transparent hover:border-base-700"
                                      >
                                          <X size={14} /> Cancelar
                                      </button>
                                  )}
                              </div>
                          ))}
                      </div>
                  </div>
              )}

              {/* EX-MEMBERS LIST */}
              {removedMembers.length > 0 && isOwner && (
                  <div className="animate-in fade-in duration-300">
                      <h3 className="text-xs font-bold text-base-muted uppercase tracking-wider mb-4 flex items-center gap-2 border-b border-base-800 pb-2">
                          <div className="w-2 h-2 rounded-full bg-base-600"></div>
                          Ex-Membros ({removedMembers.length})
                      </h3>
                      <div className="space-y-3">
                          {removedMembers.map(member => (
                              <div key={member.email} className="flex items-center justify-between p-3 bg-base-950 border border-base-800 rounded-lg opacity-60 hover:opacity-100 transition-opacity">
                                  <div className="flex items-center gap-3 grayscale">
                                      <div className="w-8 h-8 rounded-full bg-base-800 text-base-600 flex items-center justify-center font-bold">
                                          <UserCheck size={14} />
                                      </div>
                                      <div>
                                          <p className="font-medium text-base-text text-sm line-through decoration-base-600">
                                              {member.nickname ? `@${member.nickname}` : member.email}
                                          </p>
                                          <p className="text-[10px] text-base-muted">Acesso Revogado</p>
                                      </div>
                                  </div>
                                  
                                  <div className="flex gap-2">
                                      <button 
                                          onClick={() => restoreMember(member)} 
                                          className="text-xs text-primary-400 hover:bg-primary-900/20 px-3 py-1.5 rounded transition-colors border border-transparent hover:border-primary-500/30"
                                          title="Restaurar Acesso"
                                      >
                                          Restaurar
                                      </button>
                                      <div className="w-px h-4 bg-base-800 self-center"></div>
                                      <button 
                                          onClick={() => removeMember(member.email, true)}
                                          className="text-xs text-red-400 hover:bg-red-900/20 px-3 py-1.5 rounded transition-colors border border-transparent hover:border-red-900/30"
                                          title="Excluir do Histórico"
                                      >
                                          Excluir
                                      </button>
                                  </div>
                              </div>
                          ))}
                      </div>
                  </div>
              )}

            </div>
          )}

          {/* TAB: INTEGRATIONS (Mantido) */}
          {activeTab === 'integrations' && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="mb-8">
                  <h2 className="text-lg font-semibold mb-2">Conectores & API</h2>
                  <p className="text-base-muted text-sm">Vincule este projeto a ferramentas externas.</p>
              </div>

              <div className="space-y-4">
                  <div className="p-6 bg-base-800 border border-base-700 rounded-xl flex items-start justify-between">
                    <div className="flex items-start gap-4">
                        <div className="p-3 bg-black rounded-lg text-white"><Trash2 size={24} /></div> {/* GitHub icon fake */}
                        <div>
                          <h3 className="font-bold text-base-text">GitHub Sync</h3>
                          <p className="text-sm text-base-muted mt-1">Sincronize issues e pull requests automaticamente.</p>
                        </div>
                    </div>
                    <button className="text-sm border border-base-600 px-3 py-1.5 rounded-lg hover:bg-base-700 transition-colors">Conectar</button>
                  </div>

                  <div className="p-6 bg-base-800 border border-base-700 rounded-xl flex items-start justify-between">
                    <div className="flex items-start gap-4">
                        <div className="p-3 bg-[#4A154B] rounded-lg text-white"><Users size={24} /></div> {/* Slack fake */}
                        <div>
                          <h3 className="font-bold text-base-text">Slack Notifications</h3>
                          <p className="text-sm text-base-muted mt-1">Receba alertas quando tarefas forem concluídas.</p>
                        </div>
                    </div>
                    <button className="text-sm border border-base-600 px-3 py-1.5 rounded-lg hover:bg-base-700 transition-colors">Conectar</button>
                  </div>
              </div>
            </div>
          )}

          {/* TAB: DANGER */}
          {activeTab === 'danger' && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="border border-red-900/50 bg-red-900/10 rounded-xl p-6">
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-red-900/20 text-red-500 rounded-lg">
                        <AlertTriangle size={24} />
                    </div>
                    <div className="flex-1">
                        <h3 className="text-lg font-bold text-red-400">Zona de Perigo</h3>
                        <p className="text-sm text-red-300/70 mt-1 mb-6">
                          Ações aqui são irreversíveis. Tenha certeza absoluta antes de prosseguir.
                        </p>

                        {isOwner ? (
                            <div className="bg-base-950/50 border border-red-900/30 p-4 rounded-lg flex items-center justify-between">
                            <div>
                                <p className="font-medium text-base-text">Excluir este projeto</p>
                                <p className="text-xs text-base-muted mt-1">Todos os documentos, tarefas e anotações serão perdidos.</p>
                            </div>
                            <button 
                                onClick={() => onDeleteProject(project.id)}
                                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                            >
                                Excluir Projeto
                            </button>
                            </div>
                        ) : (
                            <div className="bg-base-950/50 border border-red-900/30 p-4 rounded-lg flex items-center justify-between">
                                <div>
                                    <p className="font-medium text-base-text">Sair do projeto</p>
                                    <p className="text-xs text-base-muted mt-1">Você perderá o acesso a este projeto.</p>
                                </div>
                                <button 
                                    onClick={() => {
                                        if(confirm("Tem certeza que deseja sair deste projeto?")) {
                                            onLeaveProject();
                                        }
                                    }}
                                    className="bg-red-900/20 hover:bg-red-900/40 text-red-400 border border-red-900/50 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                                >
                                    Sair do Projeto
                                </button>
                            </div>
                        )}
                    </div>
                  </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
