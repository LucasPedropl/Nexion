
import React, { useState, useEffect } from 'react';
import { Project, ViewMode, ThemeId } from './types';
import {
	getProjects,
	saveProject,
	deleteProject,
	createInitialProject,
} from './services/firebase';
import { subscribeToAuth, NexionUser, createUserProfile } from './services/auth';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { ProjectView } from './components/ProjectView';
import { Settings } from './components/Settings';
import { ProjectSettings } from './components/ProjectSettings';
import { NotificationsPage } from './components/NotificationsPage';
import { AuthPage } from './components/AuthPage';
import { X, AlertTriangle, Edit2, AtSign, Loader2, ArrowRight } from 'lucide-react';

const App: React.FC = () => {
    // Auth State
    const [user, setUser] = useState<NexionUser | null>(null);
    const [isAuthLoading, setIsAuthLoading] = useState(true);

    // App Data State
	const [projects, setProjects] = useState<Project[]>([]);
	const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
	const [currentView, setCurrentView] = useState<ViewMode>('dashboard');
	const [isDataLoading, setIsDataLoading] = useState(false);

    // Nickname Setup State (For social login first time)
    const [nickname, setNickname] = useState('');
    const [isSavingNick, setIsSavingNick] = useState(false);
    const [nickError, setNickError] = useState<string | null>(null);

	// Modal States
	const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
	const [newProjectName, setNewProjectName] = useState('');

	// Delete Modal
	const [projectToDeleteId, setProjectToDeleteId] = useState<string | null>(
		null
	);

	// Rename Modal
	const [projectToRename, setProjectToRename] = useState<Project | null>(
		null
	);
	const [renameProjectName, setRenameProjectName] = useState('');

	// Inicializa o tema a partir do LocalStorage ou usa o padrão
	const [currentTheme, setCurrentTheme] = useState<ThemeId>(() => {
		if (typeof window !== 'undefined') {
			return (
				(localStorage.getItem('nexion_theme') as ThemeId) || 'sunset'
			);
		}
		return 'sunset';
	});

	// Salva o tema no LocalStorage sempre que mudar
	useEffect(() => {
		localStorage.setItem('nexion_theme', currentTheme);
		document.documentElement.setAttribute('data-theme', currentTheme);
	}, [currentTheme]);

    // Monitor Auth State
    useEffect(() => {
        const unsubscribe = subscribeToAuth((currentUser) => {
            setUser(currentUser);
            setIsAuthLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const loadProjects = async () => {
        if (!user || !user.nickname) {
            setProjects([]);
            return;
        }
        setIsDataLoading(true);
        try {
            const data = await getProjects(user as any); // Cast para User do Firebase
            setProjects(data);
        } catch (error) {
            console.error('Falha ao carregar projetos', error);
        } finally {
            setIsDataLoading(false);
        }
    };

	// Load projects when user changes and HAS NICKNAME
	useEffect(() => {
		if (!isAuthLoading && user?.nickname) {
            loadProjects();
        }
	}, [user, isAuthLoading]);

    // Handler para Salvar Nickname (Social Login First Time)
    const handleSaveNickname = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !nickname.trim()) return;
        
        setIsSavingNick(true);
        setNickError(null);

        try {
            if (nickname.includes(' ')) throw new Error("Apelido não pode ter espaços.");
            
            await createUserProfile(user.uid!, {
                email: user.email!,
                displayName: user.displayName || 'User',
                nickname: nickname,
                photoURL: user.photoURL || ''
            });
            // O subscribeToAuth deve atualizar o user state automaticamente via listener
        } catch (err: any) {
            setNickError(err.message || "Erro ao salvar apelido.");
        } finally {
            setIsSavingNick(false);
        }
    };

	const handleOpenCreateModal = () => {
		setNewProjectName('');
		setIsCreateModalOpen(true);
	};

	const handleConfirmCreateProject = async () => {
		if (!newProjectName.trim() || !user) return;

		const newProject = createInitialProject(user as any);
		newProject.name = newProjectName; 

		await saveProject(newProject);
		setProjects((prev) => [newProject, ...prev]);
		setActiveProjectId(newProject.id);
		setCurrentView('project');
		setIsCreateModalOpen(false);
	};

	const handleUpdateProject = async (updatedProject: Project) => {
		// Optimistic UI update
		setProjects((prev) =>
			prev.map((p) => (p.id === updatedProject.id ? updatedProject : p))
		);
		await saveProject(updatedProject);
	};

	const handleReorderProjects = async (reorderedProjects: Project[]) => {
		const updatedProjects = reorderedProjects.map((p, index) => ({
			...p,
			order: index,
		}));

		setProjects(updatedProjects);

		try {
			await Promise.all(updatedProjects.map((p) => saveProject(p)));
		} catch (error) {
			console.error('Failed to save project order', error);
		}
	};

    const handleLeaveProject = async (projectToLeave: Project) => {
        if (!user) return;
        
        // Remove user from team and members
        const updatedTeam = projectToLeave.team.filter(m => m.email !== user.email);
        const updatedMembers = projectToLeave.members.filter(e => e !== user.email);
        
        const updatedProject = {
            ...projectToLeave,
            team: updatedTeam,
            members: updatedMembers
        };

        await saveProject(updatedProject);
        
        // Update local state
        setProjects(prev => prev.filter(p => p.id !== projectToLeave.id));
        
        if (activeProjectId === projectToLeave.id) {
            setActiveProjectId(null);
            setCurrentView('dashboard');
        }
    };

	const handleRequestDelete = (id: string) => {
		setProjectToDeleteId(id);
	};

	const handleConfirmDelete = async () => {
		if (projectToDeleteId) {
			await deleteProject(projectToDeleteId);
			setProjects((prev) =>
				prev.filter((p) => p.id !== projectToDeleteId)
			);

			// Se estava no projeto excluído, volta pro dashboard
			if (activeProjectId === projectToDeleteId) {
				setActiveProjectId(null);
				setCurrentView('dashboard');
			}
			setProjectToDeleteId(null);
		}
	};

	const handleSelectProject = (id: string | null) => {
		if (id) {
			setActiveProjectId(id);
			setCurrentView('project');
		} else {
			setActiveProjectId(null);
			setCurrentView('dashboard');
		}
	};

	const handleOpenSettings = () => {
		setActiveProjectId(null);
		setCurrentView('settings');
	};

    const handleOpenNotifications = () => {
        setActiveProjectId(null);
        setCurrentView('notifications');
    };

	const handleOpenProjectSettings = (projectId: string) => {
		setActiveProjectId(projectId);
		setCurrentView('project-settings');
	};

	const handleOpenRenameModal = (project: Project) => {
		setProjectToRename(project);
		setRenameProjectName(project.name);
	};

	const handleConfirmRename = async () => {
		if (projectToRename && renameProjectName.trim()) {
			const updated = { ...projectToRename, name: renameProjectName };
			await handleUpdateProject(updated);
			setProjectToRename(null);
		}
	};

    // --- RENDER ---

	if (isAuthLoading) {
		return (
			<div className="h-screen w-screen bg-slate-900 flex items-center justify-center text-indigo-500">
				<svg className="animate-spin h-10 w-10" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
					<circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
					<path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
				</svg>
			</div>
		);
	}

    if (!user) {
        return <AuthPage />;
    }

    // --- NICKNAME SETUP SCREEN ---
    // Exibido se o usuário está logado mas não tem nickname (provavelmente login social novo)
    if (!user.nickname) {
        return (
            <div className="h-screen w-screen bg-base-950 flex items-center justify-center p-4">
                <div className="w-full max-w-md bg-base-900 border border-base-800 rounded-2xl p-8 shadow-2xl animate-in fade-in zoom-in-95">
                    <div className="text-center mb-6">
                        <div className="w-12 h-12 bg-amber-500 rounded-xl mx-auto flex items-center justify-center text-white mb-4">
                            <AtSign size={24} />
                        </div>
                        <h2 className="text-xl font-bold text-white">Quase lá!</h2>
                        <p className="text-base-muted mt-2">
                            Para colaborar em projetos, você precisa definir um apelido único.
                        </p>
                    </div>

                    {nickError && (
                        <div className="mb-4 p-3 bg-red-900/20 border border-red-900/50 rounded-lg flex items-center gap-2 text-red-400 text-sm">
                            <AlertTriangle size={16} />
                            {nickError}
                        </div>
                    )}

                    <form onSubmit={handleSaveNickname} className="space-y-4">
                        <div>
                            <label className="block text-xs font-semibold text-base-muted uppercase mb-1.5 ml-1">
                                Escolha seu Nickname
                            </label>
                            <div className="relative">
                                <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 text-base-muted" size={18} />
                                <input 
                                    autoFocus
                                    type="text" 
                                    placeholder="ex: dev_master"
                                    value={nickname}
                                    onChange={(e) => setNickname(e.target.value.toLowerCase().replace(/\s/g, ''))}
                                    className="w-full bg-base-950 border border-base-700 text-white pl-10 pr-4 py-3 rounded-xl focus:border-primary-500 focus:outline-none transition-colors placeholder-base-700"
                                    required
                                />
                            </div>
                        </div>

                        <button 
                            type="submit" 
                            disabled={isSavingNick || !nickname.trim()}
                            className="w-full bg-primary-600 hover:bg-primary-500 text-white font-medium py-3 rounded-xl transition-all shadow-lg shadow-primary-900/20 flex items-center justify-center gap-2"
                        >
                            {isSavingNick ? <Loader2 className="animate-spin" size={20} /> : (
                                <>
                                    Finalizar Cadastro
                                    <ArrowRight size={18} />
                                </>
                            )}
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    // Loading de dados interno (após login e nickname ok)
	if (isDataLoading && projects.length === 0) {
		return (
			<div className="h-screen w-screen bg-base-900 flex items-center justify-center text-primary-500">
                <div className="flex flex-col items-center gap-4">
				    <svg className="animate-spin h-10 w-10" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
					    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
					    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
				    </svg>
                    <p className="text-base-muted animate-pulse">Sincronizando projetos...</p>
                </div>
			</div>
		);
	}

	const activeProject = projects.find((p) => p.id === activeProjectId);

	return (
		<>
			<Layout
				projects={projects}
				activeProjectId={activeProjectId}
				currentView={currentView}
				onSelectProject={handleSelectProject}
				onAddProject={handleOpenCreateModal}
				onOpenSettings={handleOpenSettings}
                onOpenNotifications={handleOpenNotifications}
				onOpenProjectSettings={handleOpenProjectSettings}
				onRequestRename={handleOpenRenameModal}
				onRequestDeleteProject={handleRequestDelete}
                onRequestLeaveProject={handleLeaveProject} 
				onReorderProjects={handleReorderProjects}
			>
				{currentView === 'settings' ? (
					<Settings
						currentTheme={currentTheme}
						onThemeChange={setCurrentTheme}
					/>
				) : currentView === 'notifications' ? (
                    <NotificationsPage onInviteAccepted={loadProjects} />
                ) : currentView === 'project-settings' && activeProject ? (
					<ProjectSettings
						project={activeProject}
						onUpdateProject={handleUpdateProject}
						onDeleteProject={handleRequestDelete}
                        onLeaveProject={() => handleLeaveProject(activeProject)}
						onBack={() => handleSelectProject(activeProject.id)}
					/>
				) : currentView === 'project' && activeProject ? (
					<ProjectView
						project={activeProject}
						onUpdateProject={handleUpdateProject}
						onDeleteProject={handleRequestDelete}
						onBack={() => {
							setActiveProjectId(null);
							setCurrentView('dashboard');
						}}
						onOpenSettings={() =>
							handleOpenProjectSettings(activeProject.id)
						}
					/>
				) : (
					<Dashboard
						projects={projects}
						onSelectProject={handleSelectProject}
						onAddProject={handleOpenCreateModal}
					/>
				)}
			</Layout>

			{/* --- MODAL: CREATE PROJECT --- */}
			{isCreateModalOpen && (
				<div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
					<div className="bg-base-900 border border-base-700 w-full max-w-md p-6 rounded-2xl shadow-2xl scale-100 animate-in zoom-in-95 duration-200 relative">
						<button
							onClick={() => setIsCreateModalOpen(false)}
							className="absolute right-4 top-4 text-base-muted hover:text-base-text transition-colors"
						>
							<X size={20} />
						</button>

						<h2 className="text-xl font-bold text-base-text mb-4">
							Novo Projeto
						</h2>
						<p className="text-base-muted text-sm mb-6">
							Dê um nome para sua nova iniciativa. Você poderá
							mudar isso depois.
						</p>

						<div className="space-y-4">
							<div>
								<label className="block text-xs font-semibold text-base-muted uppercase mb-1.5">
									Nome do Projeto
								</label>
								<input
									autoFocus
									type="text"
									placeholder="Ex: API Gateway V2"
									value={newProjectName}
									onChange={(e) =>
										setNewProjectName(e.target.value)
									}
									onKeyDown={(e) =>
										e.key === 'Enter' &&
										handleConfirmCreateProject()
									}
									className="w-full bg-base-800 border border-base-700 text-base-text px-4 py-3 rounded-xl focus:border-primary-500 outline-none transition-all placeholder-base-600"
								/>
							</div>

							<div className="flex justify-end gap-3 pt-2">
								<button
									onClick={() => setIsCreateModalOpen(false)}
									className="px-4 py-2.5 text-sm font-medium text-base-muted hover:text-base-text transition-colors"
								>
									Cancelar
								</button>
								<button
									onClick={handleConfirmCreateProject}
									disabled={!newProjectName.trim()}
									className="px-6 py-2.5 text-sm font-medium bg-primary-600 hover:bg-primary-500 text-white rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-primary-900/20"
								>
									Criar Projeto
								</button>
							</div>
						</div>
					</div>
				</div>
			)}

			{/* --- MODAL: RENAME PROJECT --- */}
			{projectToRename && (
				<div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
					<div className="bg-base-900 border border-base-700 w-full max-w-md p-6 rounded-2xl shadow-2xl scale-100 animate-in zoom-in-95 duration-200 relative">
						<button
							onClick={() => setProjectToRename(null)}
							className="absolute right-4 top-4 text-base-muted hover:text-base-text transition-colors"
						>
							<X size={20} />
						</button>

						<h2 className="text-xl font-bold text-base-text mb-4 flex items-center gap-2">
							<Edit2 size={20} className="text-primary-400" />
							Renomear Projeto
						</h2>
						<p className="text-base-muted text-sm mb-6">
							Atualize o nome de identificação do projeto.
						</p>

						<div className="space-y-4">
							<div>
								<label className="block text-xs font-semibold text-base-muted uppercase mb-1.5">
									Novo Nome
								</label>
								<input
									autoFocus
									type="text"
									value={renameProjectName}
									onChange={(e) =>
										setRenameProjectName(e.target.value)
									}
									onKeyDown={(e) =>
										e.key === 'Enter' &&
										handleConfirmRename()
									}
									className="w-full bg-base-800 border border-base-700 text-base-text px-4 py-3 rounded-xl focus:border-primary-500 outline-none transition-all placeholder-base-600"
								/>
							</div>

							<div className="flex justify-end gap-3 pt-2">
								<button
									onClick={() => setProjectToRename(null)}
									className="px-4 py-2.5 text-sm font-medium text-base-muted hover:text-base-text transition-colors"
								>
									Cancelar
								</button>
								<button
									onClick={handleConfirmRename}
									disabled={!renameProjectName.trim()}
									className="px-6 py-2.5 text-sm font-medium bg-primary-600 hover:bg-primary-500 text-white rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-primary-900/20"
								>
									Salvar
								</button>
							</div>
						</div>
					</div>
				</div>
			)}

			{/* --- MODAL: DELETE CONFIRMATION --- */}
			{projectToDeleteId && (
				<div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
					<div className="bg-base-900 border border-red-900/30 w-full max-w-md p-6 rounded-2xl shadow-2xl relative animate-in zoom-in-95 duration-200">
						<div className="flex flex-col items-center text-center mb-6">
							<div className="w-16 h-16 bg-red-900/20 rounded-full flex items-center justify-center text-red-500 mb-4">
								<AlertTriangle size={32} />
							</div>
							<h2 className="text-xl font-bold text-base-text">
								Excluir Projeto?
							</h2>
							<p className="text-base-muted text-sm mt-2">
								Você está prestes a excluir permanentemente o
								projeto{' '}
								<span className="text-base-text font-semibold">
									"
									{
										projects.find(
											(p) => p.id === projectToDeleteId
										)?.name
									}
									"
								</span>
								.
								<br />
								Essa ação não pode ser desfeita.
							</p>
						</div>

						<div className="flex gap-3 justify-center">
							<button
								onClick={() => setProjectToDeleteId(null)}
								className="flex-1 px-4 py-2.5 text-sm font-medium bg-base-800 hover:bg-base-700 text-base-text rounded-xl transition-colors"
							>
								Cancelar
							</button>
							<button
								onClick={handleConfirmDelete}
								className="flex-1 px-4 py-2.5 text-sm font-medium bg-red-600 hover:bg-red-500 text-white rounded-xl transition-colors shadow-lg shadow-red-900/20"
							>
								Sim, Excluir
							</button>
						</div>
					</div>
				</div>
			)}
		</>
	);
};

export default App;
