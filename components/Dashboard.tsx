
import React, { useState } from 'react';
import { Project } from '../types';
import { CheckCircle2, FileText, Plus, Search, FolderGit2 } from 'lucide-react';
import { ProjectIconDisplay } from './Layout';

interface DashboardProps {
  projects: Project[];
  onSelectProject: (id: string) => void;
  onAddProject: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ projects, onSelectProject, onAddProject }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredProjects = projects.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex-1 p-8 bg-base-900 text-base-text min-h-full">
      <div className="max-w-6xl mx-auto">
        <header className="mb-10">
          <h1 className="text-3xl font-bold text-base-text mb-2">Bem-vindo, Dev.</h1>
          <p className="text-base-muted">Gerencie seu fluxo de desenvolvimento, reuniões e documentação em um só lugar.</p>
        </header>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <h2 className="text-xl font-semibold text-base-text">Projetos Ativos</h2>
          
          <div className="flex gap-4">
             <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-base-muted" size={16} />
                <input 
                  type="text" 
                  placeholder="Buscar projetos..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="bg-base-800 border border-base-700 text-base-text pl-10 pr-4 py-2 rounded-lg text-sm focus:outline-none focus:border-primary-500 w-64 placeholder-base-600"
                />
             </div>
            <button 
              onClick={onAddProject}
              className="flex items-center gap-2 bg-primary-600 hover:bg-primary-500 text-white px-4 py-2 rounded-lg transition-colors shadow-lg shadow-primary-900/20 text-sm font-medium"
            >
              <Plus size={18} />
              Novo Projeto
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProjects.map((project) => {
            const activeTasks = project.tasks.filter(t => t.status !== 'todo').length;
            const completedTasks = project.tasks.filter(t => t.status === 'done').length;
            const totalTasks = project.tasks.length;
            const progress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
            
            return (
              <div 
                key={project.id}
                onClick={() => onSelectProject(project.id)}
                className="group bg-base-800 border border-base-700 hover:border-primary-500/50 rounded-xl p-6 cursor-pointer transition-all hover:shadow-xl hover:-translate-y-1"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="p-3 bg-base-900 rounded-lg group-hover:bg-primary-900/20 group-hover:text-primary-400 transition-colors text-base-muted flex items-center justify-center">
                    <ProjectIconDisplay icon={project.icon} size={24} />
                  </div>
                  <span className="text-xs text-base-muted font-mono">
                    {new Date(project.createdAt).toLocaleDateString('pt-BR')}
                  </span>
                </div>

                <h3 className="text-lg font-bold text-base-text mb-2 truncate">{project.name}</h3>
                <p className="text-sm text-base-muted mb-6 line-clamp-2 h-10">
                  {project.description}
                </p>

                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs text-base-muted">
                    <span>Progresso</span>
                    <span>{Math.round(progress)}%</span>
                  </div>
                  <div className="w-full bg-base-900 rounded-full h-1.5 overflow-hidden">
                    <div 
                      className="bg-primary-500 h-full rounded-full transition-all duration-500" 
                      style={{ width: `${progress}%` }}
                    ></div>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-base-700/50 flex items-center justify-between text-sm text-base-muted">
                  <div className="flex items-center gap-1">
                    <CheckCircle2 size={14} className={activeTasks > 0 ? "text-amber-400" : "text-base-600"} />
                    <span>{activeTasks} Ativas</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <FileText size={14} />
                    <span>{project.docs.length} Docs</span>
                  </div>
                </div>
              </div>
            );
          })}
          
          {projects.length === 0 && (
             <div className="col-span-full py-20 text-center border-2 border-dashed border-base-800 rounded-xl">
               <p className="text-base-muted mb-4">Nenhum projeto encontrado. Crie um para começar.</p>
               <button onClick={onAddProject} className="text-primary-400 hover:text-primary-300 font-medium">Criar Projeto &rarr;</button>
             </div>
          )}
          
          {projects.length > 0 && filteredProjects.length === 0 && (
              <div className="col-span-full py-10 text-center">
                  <p className="text-base-muted">Nenhum projeto corresponde à sua busca.</p>
              </div>
          )}
        </div>
      </div>
    </div>
  );
};
