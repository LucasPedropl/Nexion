
import React, { useState, useRef } from 'react';
import { Project } from '../types';
import { 
  ArrowLeft, Trash2, Save, LayoutTemplate, Palette, 
  Users, Plug2, AlertTriangle, ShieldAlert, Upload, Image as ImageIcon, Link,
  Layers, Plus, X
} from 'lucide-react';
import { iconMap, ProjectIconDisplay } from './Layout';

interface ProjectSettingsProps {
  project: Project;
  onUpdateProject: (p: Project) => void;
  onDeleteProject: (id: string) => void;
  onBack: () => void;
}

type SettingsTab = 'general' | 'architecture' | 'team' | 'integrations' | 'danger';

export const ProjectSettings: React.FC<ProjectSettingsProps> = ({ 
  project, 
  onUpdateProject, 
  onDeleteProject, 
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
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Mock states for Team and Integrations
  const [inviteEmail, setInviteEmail] = useState('');

  const handleSave = () => {
    onUpdateProject({
      ...project,
      name: formData.name,
      description: formData.description,
      icon: formData.icon,
      subsystems: formData.subsystems,
      roles: formData.roles
    });
    alert("Projeto atualizado com sucesso!");
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          // Resize image to max 256x256
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

  return (
    <div className="flex flex-col bg-base-900 text-base-text min-h-full">
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

          {/* TAB: TEAM */}
          {activeTab === 'team' && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="mb-8">
                  <h2 className="text-lg font-semibold mb-2">Gerenciar Acesso</h2>
                  <p className="text-base-muted text-sm">Convide membros da equipe para colaborar neste projeto.</p>
              </div>

              <div className="bg-base-800 border border-base-700 rounded-xl p-6 mb-8">
                  <div className="flex gap-4">
                    <input 
                      type="email" 
                      placeholder="email@desenvolvedor.com" 
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      className="flex-1 bg-base-900 border border-base-700 rounded-lg px-4 py-2 text-base-text focus:border-primary-500 outline-none"
                    />
                    <button className="bg-primary-600 hover:bg-primary-500 text-white px-4 py-2 rounded-lg font-medium transition-colors">
                      Convidar
                    </button>
                  </div>
              </div>

              <h3 className="text-sm font-bold text-base-muted uppercase tracking-wider mb-4">Membros Atuais</h3>
              <div className="space-y-3">
                  <div className="flex items-center justify-between p-4 bg-base-800 border border-base-700 rounded-lg">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary-900 text-primary-300 flex items-center justify-center font-bold">EU</div>
                        <div>
                          <p className="font-medium text-base-text">Você</p>
                          <p className="text-xs text-base-muted">Proprietário</p>
                        </div>
                    </div>
                    <span className="text-xs bg-primary-500/20 text-primary-400 px-2 py-1 rounded-full border border-primary-500/30">Admin</span>
                  </div>
                  
                  {/* Mock Users */}
                  <div className="flex items-center justify-between p-4 bg-base-800 border border-base-700 rounded-lg opacity-60">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-base-700 text-base-400 flex items-center justify-center font-bold">JS</div>
                        <div>
                          <p className="font-medium text-base-text">Jane Silva</p>
                          <p className="text-xs text-base-muted">jane@exemplo.com</p>
                        </div>
                    </div>
                    <span className="text-xs bg-base-700 text-base-400 px-2 py-1 rounded-full">Pendente</span>
                  </div>
              </div>
            </div>
          )}

          {/* TAB: INTEGRATIONS */}
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
                          <h3 className="font-bold text-base-text">GitHub Repo</h3>
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
