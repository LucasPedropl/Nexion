

import React, { useState, useEffect, useRef } from 'react';
import { Project, ProjectTab, Task, TaskStatus, TaskPriority, ProjectNote } from '../types';
import { 
  ArrowLeft, Save, Trash2, Wand2, FileText, CheckSquare, 
  StickyNote, LayoutTemplate, Plus, Edit2, Check, X, Search, Settings,
  Filter, Layers, UserCircle, ChevronDown, User, Target, LayoutGrid, SquareKanban,
  Paperclip, Image as ImageIcon, Maximize2, Activity, AlertCircle, Clock, Zap, ArrowRight, FileClock
} from 'lucide-react';
import { analyzeNotesToTasks, refineDocumentation } from '../services/geminiService';
import { ProjectIconDisplay } from './Layout';
import { AiAssistant } from './AiAssistant';

interface ProjectViewProps {
  project: Project;
  onUpdateProject: (p: Project) => void;
  onDeleteProject: (id: string) => void;
  onBack: () => void;
  onOpenSettings: () => void;
}

export const ProjectView: React.FC<ProjectViewProps> = ({ 
  project, 
  onUpdateProject, 
  onDeleteProject, 
  onBack,
  onOpenSettings
}) => {
  const [activeTab, setActiveTab] = useState<ProjectTab>('overview');
  const [isAiLoading, setIsAiLoading] = useState(false);
  
  // Scope / Context State
  const [activeScope, setActiveScope] = useState<string>('all'); // 'all' or subsystem name
  const [isScopeMenuOpen, setIsScopeMenuOpen] = useState(false);
  const scopeMenuRef = useRef<HTMLDivElement>(null);

  // Notes state (now specific to scope)
  const [currentNoteContent, setCurrentNoteContent] = useState('');
  const [noteAttachments, setNoteAttachments] = useState<string[]>([]);
  
  // Docs state
  const [editingDocId, setEditingDocId] = useState<string | null>(null);
  
  // Task Editing state
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [taskEditForm, setTaskEditForm] = useState<{
    title: string, 
    description: string, 
    priority: TaskPriority, 
    scope?: string, 
    role?: string,
    attachments: string[]
  }>({ 
    title: '', description: '', priority: 'medium', scope: '', role: '', attachments: []
  });
  const [showNewTaskForm, setShowNewTaskForm] = useState(false);

  // Kanban State
  const [kanbanDragTask, setKanbanDragTask] = useState<Task | null>(null);

  // Lightbox State
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // References for file inputs
  const taskFileInputRef = useRef<HTMLInputElement>(null);
  const noteFileInputRef = useRef<HTMLInputElement>(null);

  // --- Effects ---

  // Close scope menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (scopeMenuRef.current && !scopeMenuRef.current.contains(event.target as Node)) {
        setIsScopeMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Load notes content when scope or project changes
  useEffect(() => {
    // Determine which notes to load based on activeScope
    const targetScope = activeScope === 'all' ? 'general' : activeScope;
    
    // Check if project.notes is an array (new format) or string (old format)
    if (Array.isArray(project.notes)) {
      const noteObj = project.notes.find(n => n.scope === targetScope);
      setCurrentNoteContent(noteObj ? noteObj.content : '');
      // Note attachments are transient (session based) for now, or could be saved in notes structure if we expanded ProjectNote type.
      // For this version, we'll keep them transient until converted to tasks.
      setNoteAttachments([]); 
    } else {
      // Legacy format migration handling in UI
      if (targetScope === 'general') {
        setCurrentNoteContent(project.notes as string || '');
      } else {
        setCurrentNoteContent('');
      }
      setNoteAttachments([]);
    }
  }, [project.id, activeScope, project.notes]);

  // --- Logic Helpers ---

  const getFilteredTasks = () => {
    if (activeScope === 'all') return project.tasks;
    return project.tasks.filter(t => t.scope === activeScope);
  };

  const getFilteredDocs = () => {
    if (activeScope === 'all') return project.docs;
    return project.docs.filter(d => d.scope === activeScope);
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  const handlePasteImage = async (e: React.ClipboardEvent, setAttachments: React.Dispatch<React.SetStateAction<string[]>>) => {
    const items = e.clipboardData.items;
    let hasImage = false;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        e.preventDefault();
        hasImage = true;
        const blob = items[i].getAsFile();
        if (blob) {
          const base64 = await fileToBase64(blob);
          setAttachments(prev => [...prev, base64]);
        }
      }
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>, setAttachments: React.Dispatch<React.SetStateAction<string[]>>) => {
    const files = e.target.files;
    if (files) {
      for (let i = 0; i < files.length; i++) {
        const base64 = await fileToBase64(files[i]);
        setAttachments(prev => [...prev, base64]);
      }
    }
    // Reset input
    if (e.target) e.target.value = '';
  };

  // --- Handlers ---

  const handleSaveNotes = () => {
    const targetScope = activeScope === 'all' ? 'general' : activeScope;
    let newNotes: ProjectNote[] = [];

    if (Array.isArray(project.notes)) {
      // Remove existing note for this scope
      newNotes = project.notes.filter(n => n.scope !== targetScope);
    } else {
      // Convert legacy string to array if needed, preserving legacy content if we are not overwriting it
      if (targetScope !== 'general' && project.notes) {
         newNotes.push({ scope: 'general', content: project.notes, lastUpdated: Date.now() });
      }
    }

    // Add updated note
    newNotes.push({
      scope: targetScope,
      content: currentNoteContent,
      lastUpdated: Date.now()
    });

    onUpdateProject({ ...project, notes: newNotes });
  };

  const handleAiProcessNotes = async () => {
    setIsAiLoading(true);
    const targetScope = activeScope === 'all' ? 'general' : activeScope;
    
    try {
      // Passa a lista de subsistemas e roles para a IA conseguir mapear corretamente
      const newTasksRaw = await analyzeNotesToTasks(
        currentNoteContent, 
        targetScope,
        project.subsystems || [],
        project.roles || []
      );

      // --- LOGICA DE DISTRIBUIÇÃO DE IMAGENS ---
      // Estratégia: Sequencial + Overflow
      // Tarefa 0 <- Imagem 0
      // Tarefa 1 <- Imagem 1
      // ...
      // Tarefa N (Última) <- Imagem N, Imagem N+1, Imagem N+2...
      
      const typedTasks: Task[] = newTasksRaw.map((t, index) => {
        // Determina quais anexos vão para esta tarefa
        let myAttachments: string[] = [];

        if (noteAttachments.length > 0) {
          if (newTasksRaw.length === 1) {
             // Se só gerou uma tarefa, ela recebe tudo
             myAttachments = [...noteAttachments];
          } else if (index < newTasksRaw.length - 1) {
             // Tarefas intermediárias pegam 1 imagem se existir
             if (noteAttachments[index]) {
               myAttachments = [noteAttachments[index]];
             }
          } else {
             // A última tarefa pega sua correspondente + todo o resto (overflow)
             myAttachments = noteAttachments.slice(index);
          }
        }

        return {
          id: crypto.randomUUID(),
          title: t.title || "Tarefa sem título",
          description: t.description || "",
          type: (t.type as any) || 'task',
          priority: (t.priority as any) || 'medium',
          status: 'todo',
          scope: t.scope, 
          role: t.role,
          createdAt: Date.now(),
          attachments: myAttachments
        };
      });
      
      onUpdateProject({
        ...project,
        tasks: [...project.tasks, ...typedTasks]
      });

      setNoteAttachments([]); // Limpa anexos após processar
      alert(`O Gemini criou ${typedTasks.length} tarefas e distribuiu ${noteAttachments.length} anexos!`);
      setActiveTab('tasks');
    } catch (e) {
      alert("Falha ao processar notas.");
      console.error(e);
    } finally {
      setIsAiLoading(false);
    }
  };

  const updateTaskStatus = (taskId: string, status: TaskStatus) => {
    const updatedTasks = project.tasks.map(t => t.id === taskId ? { ...t, status } : t);
    onUpdateProject({ ...project, tasks: updatedTasks });
  };

  const deleteTask = (taskId: string) => {
    if(confirm("Excluir esta tarefa?")) {
        onUpdateProject({ ...project, tasks: project.tasks.filter(t => t.id !== taskId) });
        setEditingTaskId(null);
    }
  };

  // --- Task Editing ---
  const startEditTask = (task: Task) => {
    setEditingTaskId(task.id);
    setTaskEditForm({ 
      title: task.title, 
      description: task.description || '', 
      priority: task.priority,
      scope: task.scope || '',
      role: task.role || '',
      attachments: task.attachments || []
    });
  };

  const saveEditTask = () => {
    if (editingTaskId) {
        const updatedTasks = project.tasks.map(t => t.id === editingTaskId ? { 
            ...t, 
            title: taskEditForm.title, 
            description: taskEditForm.description,
            priority: taskEditForm.priority,
            scope: taskEditForm.scope || undefined,
            role: taskEditForm.role || undefined,
            attachments: taskEditForm.attachments
        } : t);
        onUpdateProject({ ...project, tasks: updatedTasks });
        setEditingTaskId(null);
    }
  };

  const handleAddNewTask = () => {
    const newTask: Task = {
      id: crypto.randomUUID(),
      title: taskEditForm.title || "Nova Tarefa",
      description: taskEditForm.description,
      priority: taskEditForm.priority,
      status: 'todo',
      type: 'task',
      scope: taskEditForm.scope || (activeScope !== 'all' ? activeScope : undefined),
      role: taskEditForm.role || undefined,
      createdAt: Date.now(),
      attachments: taskEditForm.attachments
    };
    onUpdateProject({ ...project, tasks: [newTask, ...project.tasks] });
    setTaskEditForm({ title: '', description: '', priority: 'medium', scope: '', role: '', attachments: [] });
    setShowNewTaskForm(false);
  };

  // --- Kanban Handlers ---
  const handleKanbanDragStart = (e: React.DragEvent, task: Task) => {
    setKanbanDragTask(task);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleKanbanDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleKanbanDrop = (e: React.DragEvent, targetStatus: TaskStatus) => {
    e.preventDefault();
    if (kanbanDragTask && kanbanDragTask.status !== targetStatus) {
      updateTaskStatus(kanbanDragTask.id, targetStatus);
    }
    setKanbanDragTask(null);
  };

  // --- Docs Logic ---
  const addNewDoc = () => {
    const newDoc = {
      id: crypto.randomUUID(),
      title: 'Nova Especificação',
      content: '# Introdução\n\nDescreva a funcionalidade aqui...',
      lastUpdated: Date.now(),
      scope: activeScope !== 'all' ? activeScope : undefined
    };
    onUpdateProject({ ...project, docs: [...project.docs, newDoc] });
    setEditingDocId(newDoc.id);
  };

  const updateDoc = (id: string, updates: Partial<typeof project.docs[0]>) => {
    const updatedDocs = project.docs.map(d => d.id === id ? { ...d, ...updates, lastUpdated: Date.now() } : d);
    onUpdateProject({ ...project, docs: updatedDocs });
  };

  const deleteDoc = (id: string) => {
    if(confirm("Excluir este documento?")) {
      const updatedDocs = project.docs.filter(d => d.id !== id);
      onUpdateProject({ ...project, docs: updatedDocs });
      if(editingDocId === id) setEditingDocId(null);
    }
  };

  const handleAiRefineDoc = async (docId: string, content: string) => {
    setIsAiLoading(true);
    const refined = await refineDocumentation(content);
    updateDoc(docId, { content: refined });
    setIsAiLoading(false);
  };

  const getPriorityColor = (p: TaskPriority) => {
    switch(p) {
        case 'high': return 'text-red-400 bg-red-400/10 border-red-400/20';
        case 'medium': return 'text-amber-400 bg-amber-400/10 border-amber-400/20';
        case 'low': return 'text-blue-400 bg-blue-400/10 border-blue-400/20';
        default: return 'text-base-muted bg-base-800';
    }
  };

  // --- DASHBOARD CALCULATIONS (Derived State) ---
  const currentTasks = getFilteredTasks();
  const currentDocs = getFilteredDocs();
  
  const totalTasks = currentTasks.length;
  const completedTasks = currentTasks.filter(t => t.status === 'done').length;
  const progress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
  
  const highPriorityTasks = currentTasks.filter(t => t.priority === 'high' && t.status !== 'done');
  const recentTasks = [...currentTasks].sort((a,b) => b.createdAt - a.createdAt).slice(0, 5);
  const recentDocs = [...currentDocs].sort((a,b) => b.lastUpdated - a.lastUpdated).slice(0, 3);
  
  // Simple Health Calculation
  const criticalBugs = currentTasks.filter(t => t.type === 'bug' && t.priority === 'high' && t.status !== 'done').length;
  const healthStatus = criticalBugs > 2 ? 'at-risk' : 'on-track';

  return (
    <div className="flex flex-col bg-base-900 text-base-text min-h-full relative">
      {/* AI Assistant Component Added Here */}
      <AiAssistant project={project} onUpdateProject={onUpdateProject} />

      {/* Header - Sticky */}
      <div className="h-16 border-b border-base-800 flex items-center justify-between px-6 bg-base-950 sticky top-0 z-30 flex-shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 hover:bg-base-800 rounded-full transition-colors text-base-muted hover:text-base-text">
            <ArrowLeft size={20} />
          </button>
          
          <div className="w-10 h-10 rounded-lg bg-base-800 border border-base-700 flex items-center justify-center text-primary-400 overflow-hidden">
            <ProjectIconDisplay icon={project.icon} size={20} />
          </div>

          <div className="flex flex-col justify-center h-full gap-0.5">
             <h1 className="text-lg font-bold text-base-text leading-none">{project.name}</h1>
             
             {/* Custom Dropdown for Context Selector */}
             <div className="relative mt-1" ref={scopeMenuRef}>
                <button 
                  onClick={() => setIsScopeMenuOpen(!isScopeMenuOpen)}
                  className="group flex items-center gap-1.5 text-xs font-medium focus:outline-none transition-colors"
                >
                   <Target size={12} className="text-primary-400" />
                   <span className="text-base-muted group-hover:text-base-text transition-colors">Contexto:</span>
                   <span className="text-primary-400 font-semibold group-hover:text-primary-300 transition-colors">
                     {activeScope === 'all' ? 'Geral (Todos)' : activeScope}
                   </span>
                   <ChevronDown size={12} className={`text-base-muted transition-transform duration-200 ${isScopeMenuOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Dropdown Menu */}
                {isScopeMenuOpen && (
                  <div className="absolute top-full left-0 mt-2 w-56 bg-base-800 border border-base-700 rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150 origin-top-left">
                    <div className="p-1">
                      <div className="px-3 py-2 text-[10px] font-bold text-base-muted uppercase tracking-wider">
                        Filtrar por Área
                      </div>
                      
                      <button
                        onClick={() => { setActiveScope('all'); setIsScopeMenuOpen(false); }}
                        className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center gap-2 transition-colors ${
                          activeScope === 'all' 
                            ? 'bg-primary-500/10 text-primary-400 font-medium' 
                            : 'text-base-text hover:bg-base-700/50'
                        }`}
                      >
                        <LayoutGrid size={14} className={activeScope === 'all' ? 'text-primary-400' : 'text-base-muted'} />
                        <span className="flex-1">Visão Geral (Todos)</span>
                        {activeScope === 'all' && <Check size={14} />}
                      </button>

                      <div className="h-px bg-base-700/50 my-1 mx-2"></div>

                      <div className="max-h-64 overflow-y-auto custom-scrollbar">
                        {(project.subsystems || []).map(sys => (
                          <button
                            key={sys}
                            onClick={() => { setActiveScope(sys); setIsScopeMenuOpen(false); }}
                            className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center gap-2 transition-colors ${
                              activeScope === sys 
                                ? 'bg-primary-500/10 text-primary-400 font-medium' 
                                : 'text-base-text hover:bg-base-700/50'
                            }`}
                          >
                            <Layers size={14} className={activeScope === sys ? 'text-primary-400' : 'text-base-muted'} />
                            <span className="flex-1 truncate">{sys}</span>
                            {activeScope === sys && <Check size={14} />}
                          </button>
                        ))}
                      </div>
                      
                      {(project.subsystems || []).length === 0 && (
                        <div className="px-3 py-2 text-xs text-base-muted italic">
                          Nenhum sub-sistema definido. Vá em configurações para adicionar.
                        </div>
                      )}
                    </div>
                  </div>
                )}
             </div>
          </div>
        </div>
        
        <button 
          onClick={onOpenSettings}
          className="text-base-muted hover:text-primary-400 p-2 rounded-md hover:bg-base-800 transition-colors"
          title="Configurações do Projeto"
        >
          <Settings size={20} />
        </button>
      </div>

      {/* Tabs - Sticky */}
      <div className="flex items-center gap-1 px-6 pt-4 border-b border-base-800 bg-base-900 sticky top-16 z-20 flex-shrink-0">
        {[
          { id: 'overview', label: 'Visão Geral', icon: LayoutTemplate },
          { id: 'tasks', label: 'Tarefas', icon: CheckSquare },
          { id: 'board', label: 'Quadro', icon: SquareKanban },
          { id: 'notes', label: 'Anotações (IA)', icon: StickyNote },
          { id: 'docs', label: 'Documentação', icon: FileText },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as ProjectTab)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id 
                ? 'border-primary-500 text-primary-400' 
                : 'border-transparent text-base-muted hover:text-base-text hover:bg-base-800/50 rounded-t-md'
            }`}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content Area */}
      <div className="flex-1">
        
        {/* TAB: OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="p-8 max-w-6xl mx-auto min-h-[calc(100vh-10rem)] animate-in fade-in duration-300">
            
            {/* Top Section: Health & Summary */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
               {/* Left: Description & Progress */}
               <div className="lg:col-span-2 flex flex-col gap-6">
                  <div className="bg-base-800 border border-base-700 rounded-xl p-6">
                      <div className="flex justify-between items-start mb-4">
                        <h2 className="text-lg font-bold text-base-text flex items-center gap-2">
                            <Activity size={20} className="text-primary-400" />
                            Status do Projeto
                        </h2>
                        <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${
                            healthStatus === 'on-track' 
                                ? 'bg-green-900/20 text-green-400 border-green-900/30' 
                                : 'bg-red-900/20 text-red-400 border-red-900/30'
                        }`}>
                            {healthStatus === 'on-track' ? 'Saudável' : 'Em Risco'}
                        </span>
                      </div>
                      
                      <div className="text-sm text-base-muted mb-6 leading-relaxed">
                         {project.description || "Adicione uma descrição para alinhar o objetivo do projeto."}
                      </div>

                      {/* Progress Bar */}
                      <div>
                        <div className="flex justify-between text-xs font-medium text-base-muted mb-2">
                           <span>Progresso Geral {activeScope !== 'all' ? `(${activeScope})` : ''}</span>
                           <span>{Math.round(progress)}% Concluído</span>
                        </div>
                        <div className="h-3 bg-base-900 rounded-full overflow-hidden border border-base-700/50">
                           <div 
                              className="h-full bg-gradient-to-r from-primary-600 to-primary-400 rounded-full transition-all duration-700 ease-out"
                              style={{ width: `${progress}%` }}
                           ></div>
                        </div>
                        <div className="flex gap-4 mt-3 text-xs text-base-muted">
                            <span className="flex items-center gap-1"><CheckSquare size={12} /> {completedTasks}/{totalTasks} tarefas</span>
                            <span className="flex items-center gap-1"><FileText size={12} /> {currentDocs.length} documentos</span>
                        </div>
                      </div>
                  </div>
               </div>

               {/* Right: Quick Context */}
               <div className="flex flex-col gap-4">
                  {/* Architecture Tags */}
                  <div className="bg-base-800 border border-base-700 rounded-xl p-5 flex-1">
                     <label className="block text-xs uppercase tracking-wider text-base-muted mb-3 font-semibold flex items-center gap-2">
                        <Layers size={14} /> Arquitetura
                     </label>
                     <div className="flex flex-wrap gap-2">
                        {(project.subsystems || ['Frontend', 'Backend']).map(s => (
                           <span key={s} className="text-xs px-2.5 py-1.5 bg-base-900 border border-base-700 rounded-lg text-base-text hover:border-primary-500/50 transition-colors cursor-default">{s}</span>
                        ))}
                     </div>
                  </div>
                  
                  {/* Role Tags */}
                  <div className="bg-base-800 border border-base-700 rounded-xl p-5 flex-1">
                     <label className="block text-xs uppercase tracking-wider text-base-muted mb-3 font-semibold flex items-center gap-2">
                        <UserCircle size={14} /> Atores
                     </label>
                     <div className="flex flex-wrap gap-2">
                        {(project.roles || ['Admin', 'User']).map(r => (
                           <span key={r} className="text-xs px-2.5 py-1.5 bg-base-900 border border-base-700 rounded-lg text-base-text hover:border-primary-500/50 transition-colors cursor-default">{r}</span>
                        ))}
                     </div>
                  </div>
               </div>
            </div>

            {/* Bento Grid Layout */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* 1. Radar de Prioridade (High Priority Tasks) */}
                <div className="bg-base-800 border border-base-700 rounded-xl flex flex-col overflow-hidden">
                    <div className="p-4 border-b border-base-700/50 bg-base-800/50 flex justify-between items-center">
                        <h3 className="font-bold text-base-text flex items-center gap-2 text-sm">
                            <AlertCircle size={16} className="text-red-400" />
                            Atenção Necessária
                        </h3>
                        <span className="text-xs bg-base-900 px-2 py-0.5 rounded text-base-muted">{highPriorityTasks.length}</span>
                    </div>
                    <div className="p-2 flex-1 overflow-y-auto max-h-[300px] custom-scrollbar">
                        {highPriorityTasks.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-base-muted/50">
                                <Check size={32} className="mb-2" />
                                <p className="text-xs">Nenhuma tarefa crítica pendente.</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {highPriorityTasks.slice(0, 5).map(task => (
                                    <div 
                                        key={task.id} 
                                        onClick={() => { setActiveTab('tasks'); startEditTask(task); }}
                                        className="p-3 bg-base-900/50 rounded-lg border border-base-700/50 hover:border-red-500/30 cursor-pointer transition-colors group"
                                    >
                                        <div className="flex justify-between items-start mb-1">
                                            <span className="text-xs font-medium text-base-text line-clamp-1">{task.title}</span>
                                            <ArrowRight size={12} className="text-base-muted opacity-0 group-hover:opacity-100 transition-opacity" />
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] uppercase text-red-400 bg-red-900/10 px-1.5 py-0.5 rounded border border-red-900/20">Alta</span>
                                            {task.scope && <span className="text-[10px] text-base-muted truncate">{task.scope}</span>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    {highPriorityTasks.length > 0 && (
                        <div className="p-2 border-t border-base-700/50 text-center">
                            <button onClick={() => setActiveTab('tasks')} className="text-xs text-primary-400 hover:text-primary-300">Ver todas</button>
                        </div>
                    )}
                </div>

                {/* 2. Timeline de Atividade Recente */}
                <div className="bg-base-800 border border-base-700 rounded-xl flex flex-col overflow-hidden">
                    <div className="p-4 border-b border-base-700/50 bg-base-800/50 flex justify-between items-center">
                        <h3 className="font-bold text-base-text flex items-center gap-2 text-sm">
                            <Clock size={16} className="text-blue-400" />
                            Atividade Recente
                        </h3>
                    </div>
                    <div className="flex-1 overflow-y-auto max-h-[300px] custom-scrollbar">
                         {recentTasks.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-base-muted/50">
                                <Activity size={32} className="mb-2" />
                                <p className="text-xs">O projeto ainda não tem atividades.</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-base-700/30">
                                {recentTasks.map(task => (
                                    <div 
                                        key={task.id} 
                                        onClick={() => { setActiveTab('tasks'); startEditTask(task); }}
                                        className="p-3 hover:bg-base-700/30 cursor-pointer transition-colors flex gap-3 items-start"
                                    >
                                        <div className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${task.status === 'done' ? 'bg-green-500' : 'bg-blue-500'}`}></div>
                                        <div>
                                            <p className="text-xs font-medium text-base-text line-clamp-1">{task.title}</p>
                                            <p className="text-[10px] text-base-muted mt-0.5 flex items-center gap-1">
                                                {task.status === 'done' ? 'Concluída' : 'Criada/Editada'} • {new Date(task.createdAt).toLocaleDateString()}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* 3. Docs & Quick Actions */}
                <div className="flex flex-col gap-6">
                    {/* Recent Docs */}
                    <div className="bg-base-800 border border-base-700 rounded-xl flex flex-col overflow-hidden flex-1">
                        <div className="p-4 border-b border-base-700/50 bg-base-800/50 flex justify-between items-center">
                            <h3 className="font-bold text-base-text flex items-center gap-2 text-sm">
                                <FileClock size={16} className="text-purple-400" />
                                Docs Recentes
                            </h3>
                        </div>
                        <div className="p-2 flex-1">
                            {recentDocs.length === 0 ? (
                                <p className="text-xs text-base-muted text-center py-4">Nenhum documento.</p>
                            ) : (
                                <div className="space-y-2">
                                    {recentDocs.map(doc => (
                                        <button 
                                            key={doc.id}
                                            onClick={() => { setActiveTab('docs'); setEditingDocId(doc.id); }}
                                            className="w-full text-left p-2.5 bg-base-900/30 hover:bg-base-700/50 rounded-lg border border-transparent hover:border-base-600 transition-colors flex items-center gap-2"
                                        >
                                            <FileText size={14} className="text-base-muted" />
                                            <span className="text-xs text-base-text truncate flex-1">{doc.title}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Quick Actions */}
                    <div className="bg-base-800 border border-base-700 rounded-xl p-4">
                        <h3 className="font-bold text-base-text flex items-center gap-2 text-sm mb-3">
                            <Zap size={16} className="text-amber-400" />
                            Ações Rápidas
                        </h3>
                        <div className="grid grid-cols-2 gap-2">
                            <button 
                                onClick={() => { setActiveTab('tasks'); setShowNewTaskForm(true); }}
                                className="flex flex-col items-center justify-center p-3 bg-base-900 hover:bg-primary-900/20 border border-base-700 hover:border-primary-500/30 rounded-lg transition-all text-xs font-medium text-base-muted hover:text-primary-400 gap-2"
                            >
                                <Plus size={18} />
                                Nova Tarefa
                            </button>
                            <button 
                                onClick={addNewDoc}
                                className="flex flex-col items-center justify-center p-3 bg-base-900 hover:bg-primary-900/20 border border-base-700 hover:border-primary-500/30 rounded-lg transition-all text-xs font-medium text-base-muted hover:text-primary-400 gap-2"
                            >
                                <FileText size={18} />
                                Novo Doc
                            </button>
                            <button 
                                onClick={() => setActiveTab('board')}
                                className="flex flex-col items-center justify-center p-3 bg-base-900 hover:bg-primary-900/20 border border-base-700 hover:border-primary-500/30 rounded-lg transition-all text-xs font-medium text-base-muted hover:text-primary-400 gap-2"
                            >
                                <SquareKanban size={18} />
                                Ver Quadro
                            </button>
                            <button 
                                onClick={() => setActiveTab('notes')}
                                className="flex flex-col items-center justify-center p-3 bg-base-900 hover:bg-primary-900/20 border border-base-700 hover:border-primary-500/30 rounded-lg transition-all text-xs font-medium text-base-muted hover:text-primary-400 gap-2"
                            >
                                <Wand2 size={18} />
                                IA Notes
                            </button>
                        </div>
                    </div>
                </div>

            </div>
          </div>
        )}

        {/* TAB: TASKS */}
        {activeTab === 'tasks' && (
          <div className="flex flex-col p-6 max-w-5xl mx-auto min-h-[calc(100vh-10rem)]">
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-3">
                 <h2 className="text-xl font-bold text-base-text">Backlog {activeScope !== 'all' ? `— ${activeScope}` : ''}</h2>
                 {activeScope === 'all' && (
                    <span className="text-xs text-base-muted bg-base-800 px-2 py-1 rounded">Vendo todos os módulos</span>
                 )}
              </div>
              <button 
                onClick={() => {
                   setShowNewTaskForm(true);
                   setTaskEditForm({
                      title: '', 
                      description: '', 
                      priority: 'medium', 
                      scope: activeScope !== 'all' ? activeScope : '',
                      role: '',
                      attachments: []
                   });
                   setEditingTaskId(null);
                }}
                className="flex items-center gap-2 bg-primary-600 hover:bg-primary-500 text-white px-4 py-2 rounded-lg text-sm transition-colors"
              >
                <Plus size={16} /> Nova Tarefa
              </button>
            </div>

            {/* Formulário de Nova Tarefa / Edição */}
            {(showNewTaskForm || editingTaskId) && (
               <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200 p-4">
                  <div className="bg-base-900 border border-base-700 w-full max-w-2xl rounded-2xl shadow-2xl scale-100 animate-in zoom-in-95 duration-200 relative flex flex-col max-h-[90vh]">
                     
                     <div className="p-6 border-b border-base-800 flex justify-between items-center">
                        <h3 className="text-lg font-bold text-base-text">
                           {editingTaskId ? "Editar Tarefa / Visualizar" : "Nova Tarefa"}
                        </h3>
                        <div className="flex items-center gap-2">
                            {editingTaskId && (
                                <button 
                                    onClick={() => deleteTask(editingTaskId)}
                                    className="p-2 hover:bg-red-900/20 text-red-400 rounded-lg transition-colors mr-2"
                                    title="Excluir Tarefa"
                                >
                                    <Trash2 size={18} />
                                </button>
                            )}
                            <button 
                                onClick={() => { setShowNewTaskForm(false); setEditingTaskId(null); }}
                                className="p-1 hover:bg-base-800 rounded text-base-muted hover:text-base-text"
                            >
                                <X size={20} />
                            </button>
                        </div>
                     </div>

                     <div className="p-6 overflow-y-auto custom-scrollbar space-y-4 flex-1">
                        <div className="flex flex-col gap-3">
                            {/* Row 1: Title */}
                            <input 
                                placeholder="Título da Tarefa"
                                value={taskEditForm.title}
                                onChange={e => setTaskEditForm({...taskEditForm, title: e.target.value})}
                                onPaste={(e) => handlePasteImage(e, (val) => {
                                    const newAttachments = typeof val === 'function' ? val(taskEditForm.attachments) : val;
                                    setTaskEditForm({...taskEditForm, attachments: newAttachments});
                                })}
                                className="w-full bg-base-800 border border-base-700 rounded-lg px-4 py-3 text-base-text focus:border-primary-500 outline-none font-bold text-lg placeholder-base-600"
                            />
                            
                            {/* Row 2: Selectors */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                {/* Priority */}
                                <div className="relative">
                                    <select 
                                        value={taskEditForm.priority}
                                        onChange={e => setTaskEditForm({...taskEditForm, priority: e.target.value as TaskPriority})}
                                        className="w-full bg-base-800 border border-base-700 rounded-lg px-3 py-2 text-base-text outline-none text-sm appearance-none cursor-pointer hover:bg-base-700 transition-colors"
                                    >
                                        <option value="high">Alta Prioridade</option>
                                        <option value="medium">Média Prioridade</option>
                                        <option value="low">Baixa Prioridade</option>
                                    </select>
                                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-base-muted pointer-events-none"/>
                                </div>
                                
                                {/* Scope */}
                                <div className="relative">
                                    <select 
                                        value={taskEditForm.scope || ''}
                                        onChange={e => setTaskEditForm({...taskEditForm, scope: e.target.value})}
                                        className="w-full bg-base-800 border border-base-700 rounded-lg px-3 py-2 text-base-text outline-none text-sm appearance-none cursor-pointer hover:bg-base-700 transition-colors"
                                    >
                                        <option value="">Geral (Sem escopo)</option>
                                        {(project.subsystems || []).map(sys => (
                                        <option key={sys} value={sys}>{sys}</option>
                                        ))}
                                    </select>
                                    <Layers size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-base-muted pointer-events-none"/>
                                </div>

                                {/* Roles / Actors */}
                                <div className="relative">
                                    <select 
                                        value={taskEditForm.role || ''}
                                        onChange={e => setTaskEditForm({...taskEditForm, role: e.target.value})}
                                        className="w-full bg-base-800 border border-base-700 rounded-lg px-3 py-2 text-base-text outline-none text-sm appearance-none cursor-pointer hover:bg-base-700 transition-colors"
                                    >
                                        <option value="">Todos os Atores</option>
                                        {(project.roles || []).map(role => (
                                        <option key={role} value={role}>{role}</option>
                                        ))}
                                    </select>
                                    <User size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-base-muted pointer-events-none"/>
                                </div>
                            </div>

                            {/* Row 3: Description & Attachments Area */}
                            <div className="flex flex-col gap-2 mt-2">
                                <label className="text-xs font-semibold text-base-muted uppercase">Descrição</label>
                                <textarea 
                                    placeholder="Descrição detalhada..."
                                    value={taskEditForm.description}
                                    onChange={e => setTaskEditForm({...taskEditForm, description: e.target.value})}
                                    onPaste={(e) => handlePasteImage(e, (val) => {
                                        const newAttachments = typeof val === 'function' ? val(taskEditForm.attachments) : val;
                                        setTaskEditForm({...taskEditForm, attachments: newAttachments});
                                    })}
                                    className="w-full bg-base-800 border border-base-700 rounded-lg px-4 py-3 text-base-text focus:border-primary-500 outline-none h-32 resize-none text-sm leading-relaxed"
                                />
                                
                                {/* Attachments Section */}
                                <div className="flex flex-col gap-2 mt-2">
                                    <label className="text-xs font-semibold text-base-muted uppercase flex justify-between items-center">
                                        <span>Anexos</span>
                                        <span className="font-normal text-[10px] normal-case opacity-70">Cole (Ctrl+V) ou clique para adicionar</span>
                                    </label>
                                    <div className="flex flex-wrap gap-3">
                                        {taskEditForm.attachments.map((img, idx) => (
                                            <div key={idx} className="relative group w-24 h-24 rounded-lg overflow-hidden border border-base-600 bg-base-950 cursor-pointer" onClick={() => setPreviewImage(img)}>
                                                <img src={img} alt={`Attachment ${idx}`} className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                                                    <Maximize2 size={16} className="text-white opacity-0 group-hover:opacity-100 drop-shadow-md" />
                                                </div>
                                                <button 
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        const newAtts = [...taskEditForm.attachments];
                                                        newAtts.splice(idx, 1);
                                                        setTaskEditForm({...taskEditForm, attachments: newAtts});
                                                    }}
                                                    className="absolute top-1 right-1 bg-red-500 text-white p-0.5 rounded shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                                                    title="Remover"
                                                >
                                                    <X size={12} />
                                                </button>
                                            </div>
                                        ))}
                                        <button 
                                            onClick={() => taskFileInputRef.current?.click()}
                                            className="w-24 h-24 rounded-lg border-2 border-dashed border-base-700 hover:border-primary-500 flex flex-col items-center justify-center text-base-muted hover:text-primary-400 transition-colors bg-base-800/50"
                                            title="Anexar Imagem"
                                        >
                                            <Plus size={20} />
                                            <span className="text-[10px] mt-1">Adicionar</span>
                                        </button>
                                        <input 
                                            type="file" 
                                            multiple 
                                            accept="image/*" 
                                            ref={taskFileInputRef} 
                                            className="hidden" 
                                            onChange={(e) => handleFileSelect(e, (val) => {
                                                const newAttachments = typeof val === 'function' ? val(taskEditForm.attachments) : val;
                                                setTaskEditForm({...taskEditForm, attachments: newAttachments});
                                            })}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                     </div>

                     <div className="p-6 border-t border-base-800 flex justify-end gap-3 bg-base-900 rounded-b-2xl">
                        <button 
                            onClick={() => { setShowNewTaskForm(false); setEditingTaskId(null); }}
                            className="px-4 py-2 text-sm text-base-muted hover:text-base-text transition-colors"
                        >
                            Cancelar
                        </button>
                        <button 
                            onClick={editingTaskId ? saveEditTask : handleAddNewTask}
                            className="px-6 py-2 bg-primary-600 hover:bg-primary-500 text-white text-sm font-medium rounded-lg transition-colors shadow-lg shadow-primary-900/20"
                        >
                            {editingTaskId ? "Salvar Alterações" : "Criar Tarefa"}
                        </button>
                     </div>
                  </div>
               </div>
            )}

            <div className="space-y-3 pb-8">
              {getFilteredTasks().length === 0 ? (
                <div className="text-center py-20 text-base-muted border-2 border-dashed border-base-800 rounded-xl">
                  <CheckSquare size={48} className="mx-auto mb-4 opacity-20" />
                  <p>Nenhuma tarefa encontrada neste contexto.</p>
                </div>
              ) : (
                getFilteredTasks().sort((a,b) => b.createdAt - a.createdAt).map(task => (
                  <div 
                    key={task.id}
                    onClick={() => startEditTask(task)} 
                    className={`group flex items-start gap-4 p-4 rounded-xl border transition-all cursor-pointer ${
                      task.status === 'done' 
                        ? 'bg-base-900/50 border-base-800 opacity-60' 
                        : 'bg-base-800 border-base-700 hover:border-primary-500/30 hover:shadow-lg hover:-translate-y-0.5'
                    }`}
                  >
                    <button 
                      onClick={(e) => {
                        e.stopPropagation(); // Prevent opening modal
                        updateTaskStatus(task.id, task.status === 'done' ? 'todo' : 'done');
                      }}
                      className={`mt-1 flex-shrink-0 w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                        task.status === 'done' 
                          ? 'bg-primary-500 border-primary-500 text-white' 
                          : 'border-base-600 hover:border-primary-400'
                      }`}
                    >
                      {task.status === 'done' && <Check size={12} />}
                    </button>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className={`font-medium truncate mr-2 ${task.status === 'done' ? 'line-through text-base-muted' : 'text-base-text'}`}>
                          {task.title}
                        </span>
                        
                        {/* Priority Badge */}
                        <span className={`text-[10px] px-2 py-0.5 rounded-full border uppercase tracking-wide font-bold ${getPriorityColor(task.priority)}`}>
                          {task.priority === 'medium' ? 'média' : task.priority === 'high' ? 'alta' : 'baixa'}
                        </span>

                        {/* Scope Badge */}
                        {task.scope && (
                           <span className="text-[10px] px-2 py-0.5 rounded-full bg-base-900 text-base-muted border border-base-700 uppercase tracking-wide flex items-center gap-1">
                              <Layers size={10} /> {task.scope}
                           </span>
                        )}

                        {/* Role Badge */}
                        {task.role && (
                           <span className="text-[10px] px-2 py-0.5 rounded-full bg-base-900 text-blue-400/80 border border-blue-900/30 uppercase tracking-wide flex items-center gap-1">
                              <User size={10} /> {task.role}
                           </span>
                        )}
                      </div>
                      {task.description && (
                        <p className="text-sm text-base-muted line-clamp-2">{task.description}</p>
                      )}
                      
                      {/* Attachments Indicator (Read-only view) */}
                      {task.attachments && task.attachments.length > 0 && (
                          <div className="flex items-center gap-2 mt-2">
                             <span className="text-xs text-base-muted flex items-center gap-1">
                                <Paperclip size={12} /> {task.attachments.length} Anexos
                             </span>
                             <div className="flex -space-x-2">
                                {task.attachments.slice(0, 3).map((src, i) => (
                                    <div key={i} className="w-8 h-8 rounded border border-base-700 bg-base-900 overflow-hidden relative shadow-sm">
                                        <img src={src} className="w-full h-full object-cover" alt="" />
                                    </div>
                                ))}
                                {task.attachments.length > 3 && (
                                    <div className="w-8 h-8 rounded border border-base-700 bg-base-800 flex items-center justify-center text-[10px] text-base-muted font-medium">
                                        +{task.attachments.length - 3}
                                    </div>
                                )}
                             </div>
                          </div>
                      )}
                    </div>

                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity self-center">
                       <button onClick={(e) => { e.stopPropagation(); startEditTask(task); }} className="p-2 hover:bg-base-700 rounded text-base-muted hover:text-primary-400">
                          <Edit2 size={16} />
                       </button>
                       <button onClick={(e) => { e.stopPropagation(); deleteTask(task.id); }} className="p-2 hover:bg-red-900/30 rounded text-base-muted hover:text-red-400">
                          <Trash2 size={16} />
                       </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* TAB: BOARD (KANBAN) */}
        {activeTab === 'board' && (
          <div className="h-[calc(100vh-10rem)] p-6 overflow-x-auto flex gap-6">
            {[
              { id: 'todo', label: 'A Fazer', color: 'bg-base-800' },
              { id: 'in-progress', label: 'Em Progresso', color: 'bg-blue-900/10 border-blue-900/30' },
              { id: 'done', label: 'Concluído', color: 'bg-green-900/10 border-green-900/30' }
            ].map((col) => (
              <div 
                key={col.id} 
                className={`flex-1 min-w-[300px] flex flex-col rounded-xl border border-base-700/50 ${col.color}`}
                onDragOver={handleKanbanDragOver}
                onDrop={(e) => handleKanbanDrop(e, col.id as TaskStatus)}
              >
                <div className="p-4 border-b border-base-700/50 flex justify-between items-center">
                   <span className="font-semibold text-base-text">{col.label}</span>
                   <span className="text-xs bg-base-900/50 px-2 py-1 rounded-full text-base-muted">
                     {getFilteredTasks().filter(t => t.status === col.id).length}
                   </span>
                </div>
                
                <div className="flex-1 p-3 overflow-y-auto custom-scrollbar space-y-3">
                   {getFilteredTasks().filter(t => t.status === col.id).map(task => (
                      <div 
                        key={task.id}
                        draggable
                        onDragStart={(e) => handleKanbanDragStart(e, task)}
                        onClick={() => startEditTask(task)}
                        className={`group bg-base-900 rounded-lg shadow-sm border border-base-700 cursor-grab active:cursor-grabbing hover:border-primary-500/50 transition-all hover:shadow-md overflow-hidden ${
                          kanbanDragTask?.id === task.id ? 'opacity-40' : ''
                        }`}
                      >
                         {/* Kanban Cover Image */}
                         {task.attachments && task.attachments.length > 0 && (
                            <div className="w-full aspect-video bg-base-950 relative border-b border-base-800/50">
                                <img src={task.attachments[0]} alt="cover" className="w-full h-full object-cover" />
                                {task.attachments.length > 1 && (
                                    <div className="absolute bottom-1 right-1 bg-black/70 text-white text-[10px] px-1.5 py-0.5 rounded-full font-medium backdrop-blur-sm">
                                        +{task.attachments.length - 1}
                                    </div>
                                )}
                            </div>
                         )}

                         <div className="p-4">
                            <div className="flex justify-between items-start mb-2">
                                <span className={`text-[10px] px-2 py-0.5 rounded-full border uppercase font-bold ${getPriorityColor(task.priority)}`}>
                                {task.priority === 'medium' ? 'média' : task.priority === 'high' ? 'alta' : 'baixa'}
                                </span>
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={(e) => { e.stopPropagation(); startEditTask(task); }} className="text-base-muted hover:text-primary-400"><Edit2 size={12} /></button>
                                </div>
                            </div>
                            <h4 className="font-medium text-sm text-base-text mb-1">{task.title}</h4>
                            {task.description && <p className="text-xs text-base-muted line-clamp-2 mb-2">{task.description}</p>}
                            
                            <div className="flex flex-wrap gap-1 mt-2 items-center">
                            {task.scope && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-base-800 text-base-muted border border-base-700 flex items-center gap-1">
                                    <Layers size={10} /> {task.scope}
                                </span>
                            )}
                            {task.role && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-base-800 text-blue-400/70 border border-blue-900/20 flex items-center gap-1">
                                    <User size={10} /> {task.role}
                                </span>
                            )}
                            </div>
                         </div>
                      </div>
                   ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* TAB: NOTES */}
        {activeTab === 'notes' && (
          <div className="flex flex-col p-6 h-[calc(100vh-10rem)]">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4 flex-shrink-0">
               <div className="flex items-center gap-3 text-base-text">
                  <h2 className="font-bold">Bloco de Notas</h2>
                  <div className="flex items-center gap-2 px-3 py-1 bg-base-800 rounded-full border border-base-700">
                     <span className="w-2 h-2 rounded-full bg-primary-500 animate-pulse"></span>
                     <span className="text-xs text-primary-400 font-mono">
                        {activeScope === 'all' ? 'Contexto Geral' : `Contexto: ${activeScope}`}
                     </span>
                  </div>
               </div>
               
               <div className="flex gap-3">
                  <button 
                    onClick={handleSaveNotes}
                    className="flex items-center gap-2 text-base-muted hover:text-base-text px-3 py-2 rounded-lg hover:bg-base-800 transition-colors text-sm"
                  >
                    <Save size={16} /> Salvar
                  </button>
                  <button 
                    onClick={handleAiProcessNotes}
                    disabled={isAiLoading || !currentNoteContent.trim()}
                    className={`flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg transition-all shadow-lg shadow-primary-900/20 text-sm ${
                      isAiLoading ? 'opacity-70 cursor-wait' : 'hover:bg-primary-500'
                    }`}
                  >
                    <Wand2 size={16} className={isAiLoading ? "animate-spin" : ""} />
                    {isAiLoading ? "Analisando..." : "Gerar Tarefas (IA)"}
                  </button>
               </div>
            </div>
            
            <div className="flex-1 relative min-h-0 flex flex-col gap-2">
                <textarea 
                  value={currentNoteContent}
                  onChange={(e) => setCurrentNoteContent(e.target.value)}
                  onPaste={(e) => handlePasteImage(e, setNoteAttachments)}
                  placeholder="Cole aqui suas anotações de reunião desestruturadas. A IA irá processar o texto, identificar tarefas, definir prioridades, atribuir contextos (Frontend, Backend, etc.) e identificar os atores responsáveis automaticamente."
                  className="flex-1 w-full bg-white border border-gray-300 p-6 rounded-xl text-gray-900 placeholder-gray-500 focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all resize-none font-mono text-sm leading-relaxed custom-scrollbar shadow-inner"
                />
                
                {/* AI Notes Attachments Area */}
                <div className="flex items-center gap-3 p-3 bg-base-800 border border-base-700 rounded-xl">
                    <button 
                        onClick={() => noteFileInputRef.current?.click()}
                        className="flex items-center gap-2 px-3 py-2 bg-base-700 hover:bg-base-600 rounded-lg text-sm text-base-text transition-colors"
                    >
                        <Paperclip size={16} /> Anexar Prints
                    </button>
                    <input 
                        type="file" 
                        multiple 
                        accept="image/*" 
                        ref={noteFileInputRef} 
                        className="hidden" 
                        onChange={(e) => handleFileSelect(e, setNoteAttachments)}
                    />
                    
                    <div className="h-6 w-px bg-base-700"></div>

                    <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-1">
                        {noteAttachments.length === 0 && (
                            <span className="text-xs text-base-muted italic">
                                Cole imagens (Ctrl+V) ou anexe para incluir nas tarefas geradas.
                            </span>
                        )}
                        {noteAttachments.map((img, idx) => (
                            <div key={idx} className="relative group w-10 h-10 rounded border border-base-600 bg-base-900 flex-shrink-0 cursor-pointer" onClick={() => setPreviewImage(img)}>
                                <img src={img} alt="" className="w-full h-full object-cover" />
                                <button 
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        const newAtts = [...noteAttachments];
                                        newAtts.splice(idx, 1);
                                        setNoteAttachments(newAtts);
                                    }}
                                    className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                                >
                                    <X size={8} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
          </div>
        )}

        {/* TAB: DOCS */}
        {activeTab === 'docs' && (
          <div className="flex items-start min-h-[calc(100vh-10rem)]">
            {/* Sidebar de Documentos - Sticky para não rolar com o conteúdo */}
            <div className="w-64 border-r border-base-800 bg-base-950/30 flex flex-col sticky top-[8rem] h-[calc(100vh-8rem)]">
              <div className="p-4 border-b border-base-800 flex-shrink-0">
                <button 
                  onClick={addNewDoc}
                  className="w-full flex items-center justify-center gap-2 bg-base-800 hover:bg-base-700 text-base-text py-2 rounded-lg text-sm transition-colors border border-base-700"
                >
                  <Plus size={14} /> Novo Documento
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                {getFilteredDocs().map(doc => (
                  <div key={doc.id} className="flex group">
                      <button
                        onClick={() => setEditingDocId(doc.id)}
                        className={`flex-1 text-left px-3 py-2 rounded-l-md text-sm truncate transition-colors ${
                          editingDocId === doc.id 
                            ? 'bg-primary-500/10 text-primary-400 font-medium' 
                            : 'text-base-muted hover:bg-base-800 hover:text-base-text'
                        }`}
                      >
                        <div className="truncate">{doc.title}</div>
                        {doc.scope && (
                            <span className="text-[10px] text-base-500 opacity-70">{doc.scope}</span>
                        )}
                      </button>
                      <button 
                        onClick={() => deleteDoc(doc.id)}
                        className={`px-2 rounded-r-md hover:text-red-400 ${
                            editingDocId === doc.id ? 'bg-primary-500/10 text-primary-400' : 'text-base-muted hover:bg-base-800'
                        }`}
                      >
                          <X size={12} />
                      </button>
                  </div>
                ))}
                {getFilteredDocs().length === 0 && (
                   <div className="px-3 py-4 text-xs text-base-muted text-center italic">
                      Sem documentos {activeScope !== 'all' ? `em ${activeScope}` : ''}
                   </div>
                )}
              </div>
            </div>

            {/* Área de Edição - Rola com a página */}
            <div className="flex-1 flex flex-col bg-base-900 min-h-[calc(100vh-10rem)]">
              {editingDocId ? (
                (() => {
                  const doc = project.docs.find(d => d.id === editingDocId);
                  if (!doc) return null;
                  return (
                    <>
                      <div className="h-14 border-b border-base-800 flex items-center justify-between px-6 bg-base-900 sticky top-[8rem] z-10">
                        <input 
                          value={doc.title}
                          onChange={(e) => updateDoc(doc.id, { title: e.target.value })}
                          className="bg-transparent font-bold text-lg text-base-text focus:outline-none flex-1 mr-4"
                          placeholder="Título do Documento"
                        />
                        
                        <div className="flex items-center gap-3">
                           {/* Doc Settings (Scope/Role) */}
                           <div className="flex items-center gap-2">
                               <select 
                                  value={doc.scope || ''}
                                  onChange={(e) => updateDoc(doc.id, { scope: e.target.value || undefined })}
                                  className="bg-base-800 border-none text-xs rounded text-base-muted py-1 outline-none"
                               >
                                  <option value="">Geral</option>
                                  {(project.subsystems || []).map(sys => <option key={sys} value={sys}>{sys}</option>)}
                               </select>
                               
                               <select 
                                  value={doc.role || ''}
                                  onChange={(e) => updateDoc(doc.id, { role: e.target.value || undefined })}
                                  className="bg-base-800 border-none text-xs rounded text-base-muted py-1 outline-none"
                               >
                                  <option value="">Público</option>
                                  {(project.roles || []).map(r => <option key={r} value={r}>{r}</option>)}
                               </select>
                           </div>

                           <div className="w-px h-4 bg-base-700"></div>

                           <button 
                             onClick={() => handleAiRefineDoc(doc.id, doc.content)}
                             disabled={isAiLoading}
                             className="flex items-center gap-2 text-xs font-medium text-primary-400 hover:text-primary-300 bg-primary-900/20 px-3 py-1.5 rounded-full border border-primary-900/50 transition-colors"
                           >
                             <Wand2 size={12} className={isAiLoading ? "animate-spin" : ""} />
                             {isAiLoading ? "Melhorando..." : "IA"}
                           </button>
                        </div>
                      </div>
                      <div className="flex-1 flex flex-col">
                        <textarea 
                          value={doc.content}
                          onChange={(e) => updateDoc(doc.id, { content: e.target.value })}
                          className="flex-1 bg-transparent p-8 text-base-text resize-none focus:outline-none font-mono text-sm leading-relaxed min-h-[500px]"
                          placeholder="# Comece a escrever seu documento aqui..."
                        />
                      </div>
                    </>
                  );
                })()
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-base-muted">
                  <FileText size={48} className="mb-4 opacity-20" />
                  <p>Selecione um documento para editar ou crie um novo.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* LIGHTBOX / FULLSCREEN IMAGE PREVIEW */}
      {previewImage && (
        <div 
            className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4 animate-in fade-in duration-200"
            onClick={() => setPreviewImage(null)}
        >
            <button 
                onClick={() => setPreviewImage(null)}
                className="absolute top-4 right-4 text-white/70 hover:text-white p-2 rounded-full hover:bg-white/10"
            >
                <X size={32} />
            </button>
            <img 
                src={previewImage} 
                alt="Full Preview" 
                className="max-w-full max-h-full object-contain rounded shadow-2xl"
                onClick={(e) => e.stopPropagation()} 
            />
        </div>
      )}
    </div>
  );
};
