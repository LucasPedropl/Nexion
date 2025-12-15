
import React, { useState, useEffect, useRef } from 'react';
import { Project } from '../types';
import { auth } from '../services/auth';
import { githubApi, GithubFile, GithubCommit } from '../services/githubService';
import { 
    FolderGit2, GitBranch, FileCode, ChevronRight, ChevronDown, 
    RefreshCw, GitCommit, FileText, Folder, ArrowLeft,
    AlertCircle, Save, Loader2, History, Code2, User, BookOpen, Plus, Clock, Rocket
} from 'lucide-react';
import { marked } from 'marked';
import { WebContainerPreview } from './WebContainerPreview';

interface RepositoryManagerProps {
    project: Project;
}

export const RepositoryManager: React.FC<RepositoryManagerProps> = ({ project }) => {
    const [selectedRepo, setSelectedRepo] = useState<string>('');
    const [branches, setBranches] = useState<string[]>([]);
    const [currentBranch, setCurrentBranch] = useState('main');
    
    // Branch Creation
    const [showBranchModal, setShowBranchModal] = useState(false);
    const [newBranchName, setNewBranchName] = useState('');
    const [isCreatingBranch, setIsCreatingBranch] = useState(false);

    // File Tree State
    const [files, setFiles] = useState<GithubFile[]>([]);
    const [currentPath, setCurrentPath] = useState('');
    const [isLoadingFiles, setIsLoadingFiles] = useState(false);
    
    // Editor State
    const [selectedFile, setSelectedFile] = useState<GithubFile | null>(null);
    const [fileContent, setFileContent] = useState('');
    const [originalContent, setOriginalContent] = useState('');
    const [isLoadingContent, setIsLoadingContent] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    
    // Commit State
    const [showCommitModal, setShowCommitModal] = useState(false);
    const [commitMessage, setCommitMessage] = useState('');
    
    // History State & Navigation
    const [activeTab, setActiveTab] = useState<'code' | 'history' | 'readme' | 'deploy'>('code');
    const [commits, setCommits] = useState<GithubCommit[]>([]);
    const [isLoadingCommits, setIsLoadingCommits] = useState(false);
    
    // Time Travel (Browsing a specific commit)
    const [historySha, setHistorySha] = useState<string | null>(null);

    // Readme Content
    const [readmeContent, setReadmeContent] = useState('');
    const [isLoadingReadme, setIsLoadingReadme] = useState(false);

    const user = auth.currentUser;

    // Helper to get owner/repo from URL
    const getRepoDetails = (url: string) => {
        const cleanUrl = url.replace('https://github.com/', '');
        const parts = cleanUrl.split('/');
        return { owner: parts[0], repo: parts[1] };
    };

    // Initialize with first repo
    useEffect(() => {
        if (project.githubRepos && project.githubRepos.length > 0) {
            setSelectedRepo(project.githubRepos[0]);
        }
    }, [project.githubRepos]);

    // Fetch Branches when repo changes
    useEffect(() => {
        if (!selectedRepo || !user?.githubToken) return;
        
        const fetchBranches = async () => {
            try {
                const { owner, repo } = getRepoDetails(selectedRepo);
                const branches = await githubApi.getBranches(user.githubToken!, owner, repo);
                setBranches(branches);
                if (branches.includes('main')) setCurrentBranch('main');
                else if (branches.includes('master')) setCurrentBranch('master');
                else if (branches.length > 0) setCurrentBranch(branches[0]);
            } catch (e) {
                console.error("Failed to fetch branches", e);
            }
        };
        fetchBranches();
    }, [selectedRepo, user]);

    // Fetch Files (Considers Branch OR History SHA)
    useEffect(() => {
        if (!selectedRepo || !user?.githubToken) return;
        
        // Don't fetch files if in deploy tab
        if (activeTab === 'deploy') return;

        const loadFiles = async () => {
            setIsLoadingFiles(true);
            try {
                const { owner, repo } = getRepoDetails(selectedRepo);
                // If historySha is present, use it as the ref, otherwise use currentBranch
                const ref = historySha || currentBranch;
                const files = await githubApi.getContents(user.githubToken!, owner, repo, currentPath, ref);
                
                // Sort folders first
                const sorted = files.sort((a, b) => {
                    if (a.type === b.type) return a.name.localeCompare(b.name);
                    return a.type === 'dir' ? -1 : 1;
                });
                
                setFiles(sorted);
            } catch (e) {
                console.error(e);
            } finally {
                setIsLoadingFiles(false);
            }
        };
        loadFiles();
    }, [selectedRepo, currentBranch, currentPath, user, historySha, activeTab]);

    // Fetch Readme (Considers Branch OR History SHA)
    useEffect(() => {
        if (activeTab === 'readme' && selectedRepo && user?.githubToken) {
            const loadReadme = async () => {
                setIsLoadingReadme(true);
                try {
                    const { owner, repo } = getRepoDetails(selectedRepo);
                    const ref = historySha || currentBranch;
                    const content = await githubApi.getReadme(user.githubToken!, owner, repo, ref);
                    setReadmeContent(content);
                } catch (e) {
                    setReadmeContent('');
                } finally {
                    setIsLoadingReadme(false);
                }
            };
            loadReadme();
        }
    }, [activeTab, selectedRepo, currentBranch, user, historySha]);

    // Load Commits
    useEffect(() => {
        if (activeTab === 'history' && selectedRepo && user?.githubToken) {
            const loadCommits = async () => {
                setIsLoadingCommits(true);
                try {
                    const { owner, repo } = getRepoDetails(selectedRepo);
                    const data = await githubApi.getCommits(user.githubToken!, owner, repo, currentBranch);
                    setCommits(data);
                } catch (e) {
                    console.error(e);
                } finally {
                    setIsLoadingCommits(false);
                }
            };
            loadCommits();
        }
    }, [activeTab, selectedRepo, currentBranch, user]);

    const handleFileClick = async (file: GithubFile) => {
        if (file.type === 'dir') {
            setCurrentPath(file.path);
        } else {
            setSelectedFile(file);
            setIsLoadingContent(true);
            try {
                const { owner, repo } = getRepoDetails(selectedRepo);
                const ref = historySha || currentBranch;
                const { content } = await githubApi.getFileContent(user?.githubToken!, owner, repo, file.path, ref);
                setFileContent(content);
                setOriginalContent(content);
            } catch (e) {
                console.error(e);
                alert("Erro ao ler arquivo. Talvez seja binário ou muito grande.");
            } finally {
                setIsLoadingContent(false);
            }
        }
    };

    const handleGoUp = () => {
        if (!currentPath) return;
        const parts = currentPath.split('/');
        parts.pop();
        setCurrentPath(parts.join('/'));
    };

    const handleCreateBranch = async () => {
        if (!newBranchName.trim() || !user?.githubToken) return;
        
        setIsCreatingBranch(true);
        try {
            const { owner, repo } = getRepoDetails(selectedRepo);
            // 1. Get SHA of current branch
            const baseSha = await githubApi.getRef(user.githubToken, owner, repo, `heads/${currentBranch}`);
            // 2. Create new Ref
            await githubApi.createBranch(user.githubToken, owner, repo, newBranchName, baseSha);
            
            // 3. Update list and switch
            setBranches(prev => [...prev, newBranchName]);
            setCurrentBranch(newBranchName);
            setShowBranchModal(false);
            setNewBranchName('');
            alert(`Branch '${newBranchName}' criada com sucesso!`);
        } catch (e: any) {
            alert(`Erro ao criar branch: ${e.message}`);
        } finally {
            setIsCreatingBranch(false);
        }
    };

    const handleCommit = async () => {
        if (!selectedFile || !commitMessage || !user?.githubToken) return;
        
        // Block commit in history mode
        if (historySha) {
            alert("Você está visualizando um commit antigo. Mude para a branch atual para editar.");
            return;
        }

        setIsSaving(true);
        try {
            const { owner, repo } = getRepoDetails(selectedRepo);
            
            await githubApi.updateFile(
                user.githubToken,
                owner, 
                repo, 
                selectedFile.path, 
                fileContent, 
                commitMessage, 
                selectedFile.sha,
                currentBranch
            );
            
            alert("Alterações salvas com sucesso!");
            setShowCommitModal(false);
            setCommitMessage('');
            // Refresh file metadata (sha)
            const updated = await githubApi.getContents(user.githubToken, owner, repo, currentPath, currentBranch);
            const newFileMeta = updated.find(f => f.path === selectedFile.path);
            if (newFileMeta) setSelectedFile(newFileMeta);
            setOriginalContent(fileContent);

        } catch (e: any) {
            console.error(e);
            alert(`Erro ao commitar: ${e.message}`);
        } finally {
            setIsSaving(false);
        }
    };

    const handleViewCommit = (sha: string) => {
        setHistorySha(sha);
        setActiveTab('code');
        setCurrentPath('');
        setSelectedFile(null);
    };

    const exitHistoryMode = () => {
        setHistorySha(null);
        setCurrentPath('');
        setSelectedFile(null);
    };

    if (!project.githubRepos || project.githubRepos.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-[50vh] text-base-muted">
                <FolderGit2 size={48} className="mb-4 opacity-20" />
                <p>Nenhum repositório conectado a este projeto.</p>
                <p className="text-sm mt-2">Vá em Configurações para adicionar.</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-[calc(100vh-10rem)] bg-base-900">
            {/* Toolbar */}
            <div className="h-16 border-b border-base-800 flex items-center px-4 gap-4 bg-base-950/50 flex-shrink-0 justify-between">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                    <FolderGit2 size={18} className="text-primary-400" />
                    <select 
                        value={selectedRepo}
                        onChange={(e) => {
                            setSelectedRepo(e.target.value);
                            setCurrentPath('');
                            setSelectedFile(null);
                            setHistorySha(null);
                        }}
                        className="bg-base-800 border border-base-700 rounded-lg px-3 py-1.5 text-xs text-base-text outline-none focus:border-primary-500 max-w-[200px]"
                    >
                        {project.githubRepos.map(r => (
                            <option key={r} value={r}>{r.replace('https://github.com/', '')}</option>
                        ))}
                    </select>

                    <div className="h-4 w-px bg-base-700 mx-2"></div>

                    <GitBranch size={16} className="text-base-muted" />
                    <div className="relative flex items-center">
                        <select 
                            value={currentBranch}
                            onChange={(e) => {
                                setCurrentBranch(e.target.value);
                                setHistorySha(null);
                                setCurrentPath('');
                                setSelectedFile(null);
                            }}
                            className="bg-transparent text-xs text-base-text outline-none cursor-pointer hover:text-primary-400 pr-2"
                        >
                            {branches.map(b => <option key={b} value={b}>{b}</option>)}
                        </select>
                        <button 
                            onClick={() => setShowBranchModal(true)}
                            className="p-1 hover:bg-base-700 rounded text-base-muted hover:text-primary-400 ml-1" 
                            title="Nova Branch"
                        >
                            <Plus size={12} />
                        </button>
                    </div>
                </div>

                {/* Tab Switcher */}
                <div className="flex bg-base-800 rounded-lg p-1 border border-base-700">
                    <button 
                        onClick={() => setActiveTab('code')}
                        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-2 ${activeTab === 'code' ? 'bg-base-700 text-base-text shadow-sm' : 'text-base-muted hover:text-base-text'}`}
                    >
                        <Code2 size={14} /> Código
                    </button>
                    <button 
                        onClick={() => setActiveTab('readme')}
                        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-2 ${activeTab === 'readme' ? 'bg-base-700 text-base-text shadow-sm' : 'text-base-muted hover:text-base-text'}`}
                    >
                        <BookOpen size={14} /> README
                    </button>
                    <button 
                        onClick={() => setActiveTab('history')}
                        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-2 ${activeTab === 'history' ? 'bg-base-700 text-base-text shadow-sm' : 'text-base-muted hover:text-base-text'}`}
                    >
                        <History size={14} /> Histórico
                    </button>
                    <button 
                        onClick={() => setActiveTab('deploy')}
                        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-2 ${activeTab === 'deploy' ? 'bg-primary-600 text-white shadow-sm' : 'text-base-muted hover:text-base-text'}`}
                    >
                        <Rocket size={14} /> Deploy
                    </button>
                </div>
            </div>

            {/* Time Travel Banner */}
            {historySha && activeTab === 'code' && (
                <div className="bg-amber-900/20 border-b border-amber-900/30 px-4 py-2 flex justify-between items-center text-xs text-amber-200">
                    <div className="flex items-center gap-2">
                        <Clock size={14} />
                        <span>Visualizando histórico no commit <strong>{historySha.substring(0, 7)}</strong> (Apenas Leitura)</span>
                    </div>
                    <button onClick={exitHistoryMode} className="underline hover:text-white">Voltar para atual</button>
                </div>
            )}

            {/* --- TAB CONTENT: DEPLOY (WEB CONTAINER) --- */}
            {activeTab === 'deploy' && (
                <div className="flex-1 overflow-hidden relative">
                    <WebContainerPreview repoUrl={selectedRepo} branch={currentBranch} />
                </div>
            )}

            {/* --- TAB CONTENT: CODE --- */}
            {activeTab === 'code' && (
                <div className="flex flex-1 overflow-hidden">
                    {/* File Tree Sidebar */}
                    <div className="w-64 border-r border-base-800 bg-base-950/30 flex flex-col flex-shrink-0">
                        <div className="p-3 border-b border-base-800 flex items-center gap-2 text-xs font-medium text-base-muted">
                            <span className="truncate flex-1">
                                {currentPath ? `.../${currentPath.split('/').pop()}` : 'Raiz'}
                            </span>
                            {currentPath && (
                                <button onClick={handleGoUp} className="p-1 hover:bg-base-800 rounded" title="Voltar">
                                    <ArrowLeft size={14} />
                                </button>
                            )}
                        </div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-0.5">
                            {isLoadingFiles ? (
                                <div className="flex justify-center p-4"><Loader2 className="animate-spin text-base-muted" size={20}/></div>
                            ) : (
                                files.map(file => (
                                    <button
                                        key={file.sha}
                                        onClick={() => handleFileClick(file)}
                                        className={`w-full text-left px-3 py-2 rounded-md text-xs flex items-center gap-2 transition-colors truncate ${
                                            selectedFile?.path === file.path 
                                                ? 'bg-primary-500/10 text-primary-400 font-medium' 
                                                : 'text-base-muted hover:bg-base-800 hover:text-base-text'
                                        }`}
                                    >
                                        {file.type === 'dir' 
                                            ? <Folder size={14} className="text-blue-400" /> 
                                            : <FileText size={14} className="text-base-500" />
                                        }
                                        <span className="truncate">{file.name}</span>
                                    </button>
                                ))
                            )}
                            {files.length === 0 && !isLoadingFiles && (
                                <p className="text-center text-xs text-base-muted py-4">Vazio</p>
                            )}
                        </div>
                    </div>

                    {/* Code Editor Area */}
                    <div className="flex-1 flex flex-col bg-base-900 min-w-0">
                        {selectedFile ? (
                            <>
                                <div className="h-10 border-b border-base-800 flex items-center justify-between px-4 bg-base-900 text-xs">
                                    <span className="text-base-text font-mono opacity-80">{selectedFile.path}</span>
                                    {fileContent !== originalContent && !historySha && (
                                        <button 
                                            onClick={() => setShowCommitModal(true)}
                                            className="flex items-center gap-2 bg-green-600 hover:bg-green-500 text-white px-3 py-1 rounded transition-colors"
                                        >
                                            <Save size={12} /> Salvar (Commit)
                                        </button>
                                    )}
                                </div>
                                <div className="flex-1 relative">
                                    {isLoadingContent ? (
                                        <div className="absolute inset-0 flex items-center justify-center bg-base-900/50 backdrop-blur-sm z-10">
                                            <Loader2 className="animate-spin text-primary-500" size={32} />
                                        </div>
                                    ) : (
                                        <textarea
                                            value={fileContent}
                                            onChange={(e) => setFileContent(e.target.value)}
                                            readOnly={!!historySha}
                                            className="w-full h-full bg-[#1e1e1e] text-[#d4d4d4] p-4 font-mono text-sm resize-none outline-none custom-scrollbar"
                                            spellCheck={false}
                                        />
                                    )}
                                </div>
                            </>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center text-base-muted">
                                <FileCode size={48} className="mb-4 opacity-20" />
                                <p>Selecione um arquivo para visualizar ou editar.</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* --- TAB CONTENT: README --- */}
            {activeTab === 'readme' && (
                <div className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-base-900">
                    <div className="max-w-4xl mx-auto bg-base-800 border border-base-700 rounded-xl p-8 min-h-[500px]">
                        {isLoadingReadme ? (
                            <div className="flex justify-center p-10"><Loader2 className="animate-spin text-primary-500" size={32}/></div>
                        ) : readmeContent ? (
                            <div 
                                className="prose prose-invert prose-sm max-w-none"
                                dangerouslySetInnerHTML={{ __html: marked.parse(readmeContent) as string }} 
                            />
                        ) : (
                            <div className="text-center text-base-muted py-10">
                                <BookOpen size={48} className="mx-auto mb-4 opacity-20" />
                                <p>README.md não encontrado neste repositório/branch.</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* --- TAB CONTENT: HISTORY --- */}
            {activeTab === 'history' && (
                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                    {isLoadingCommits ? (
                        <div className="flex justify-center p-10"><Loader2 className="animate-spin text-primary-500" size={32}/></div>
                    ) : (
                        <div className="space-y-4 max-w-4xl mx-auto">
                            {commits.map(commit => (
                                <div key={commit.sha} className="bg-base-800 border border-base-700 rounded-xl p-4 flex gap-4 hover:border-primary-500/30 transition-colors group">
                                    <div className="mt-1">
                                        <GitCommit size={20} className="text-primary-400" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-base-text mb-1">{commit.commit.message}</p>
                                        <div className="flex items-center gap-3 text-xs text-base-muted">
                                            <span className="flex items-center gap-1">
                                                <User size={12} /> {commit.commit.author.name}
                                            </span>
                                            <span>•</span>
                                            <span>{new Date(commit.commit.author.date).toLocaleDateString()} às {new Date(commit.commit.author.date).toLocaleTimeString()}</span>
                                            <span>•</span>
                                            <span className="font-mono bg-base-950 px-1.5 py-0.5 rounded text-[10px] text-primary-400">{commit.sha.substring(0, 7)}</span>
                                        </div>
                                    </div>
                                    <div className="flex gap-2 self-center">
                                        <button
                                            onClick={() => handleViewCommit(commit.sha)}
                                            className="px-3 py-1.5 rounded-lg border border-base-600 hover:bg-base-700 text-xs font-medium text-base-text transition-colors flex items-center gap-2"
                                        >
                                            <Code2 size={14} /> Ver Código
                                        </button>
                                        <a 
                                            href={commit.html_url} 
                                            target="_blank" 
                                            rel="noreferrer"
                                            className="p-2 text-base-muted hover:text-base-text hover:bg-base-700 rounded-lg"
                                            title="Ver no GitHub"
                                        >
                                            <ChevronRight size={16} />
                                        </a>
                                    </div>
                                </div>
                            ))}
                            {commits.length === 0 && (
                                <p className="text-center text-base-muted">Nenhum commit encontrado neste branch.</p>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Commit Modal */}
            {showCommitModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-base-900 border border-base-700 w-full max-w-md rounded-xl shadow-2xl p-6">
                        <h3 className="text-lg font-bold text-base-text mb-4">Salvar Alterações</h3>
                        <div className="mb-4">
                            <label className="block text-sm text-base-muted mb-2">Mensagem do Commit</label>
                            <textarea 
                                autoFocus
                                value={commitMessage}
                                onChange={(e) => setCommitMessage(e.target.value)}
                                className="w-full bg-base-800 border border-base-700 rounded-lg p-3 text-sm text-base-text focus:border-primary-500 outline-none h-24 resize-none"
                                placeholder="Descreva o que mudou..."
                            />
                        </div>
                        <div className="flex justify-end gap-3">
                            <button 
                                onClick={() => setShowCommitModal(false)}
                                className="px-4 py-2 text-sm text-base-muted hover:text-base-text"
                            >
                                Cancelar
                            </button>
                            <button 
                                onClick={handleCommit}
                                disabled={isSaving || !commitMessage.trim()}
                                className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg text-sm font-medium flex items-center gap-2 disabled:opacity-50"
                            >
                                {isSaving ? <Loader2 className="animate-spin" size={14} /> : <GitCommit size={14} />}
                                Commitar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Branch Modal */}
            {showBranchModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-base-900 border border-base-700 w-full max-w-md rounded-xl shadow-2xl p-6">
                        <h3 className="text-lg font-bold text-base-text mb-4">Criar Nova Branch</h3>
                        <p className="text-xs text-base-muted mb-4">A branch será criada a partir do estado atual de <strong>{currentBranch}</strong>.</p>
                        <div className="mb-4">
                            <label className="block text-sm text-base-muted mb-2">Nome da Branch</label>
                            <input 
                                autoFocus
                                type="text"
                                value={newBranchName}
                                onChange={(e) => setNewBranchName(e.target.value.replace(/[^a-zA-Z0-9-_/]/g, ''))}
                                className="w-full bg-base-800 border border-base-700 rounded-lg p-3 text-sm text-base-text focus:border-primary-500 outline-none"
                                placeholder="ex: feature/nova-tela"
                            />
                        </div>
                        <div className="flex justify-end gap-3">
                            <button 
                                onClick={() => setShowBranchModal(false)}
                                className="px-4 py-2 text-sm text-base-muted hover:text-base-text"
                            >
                                Cancelar
                            </button>
                            <button 
                                onClick={handleCreateBranch}
                                disabled={isCreatingBranch || !newBranchName.trim()}
                                className="px-4 py-2 bg-primary-600 hover:bg-primary-500 text-white rounded-lg text-sm font-medium flex items-center gap-2 disabled:opacity-50"
                            >
                                {isCreatingBranch ? <Loader2 className="animate-spin" size={14} /> : <GitBranch size={14} />}
                                Criar Branch
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
