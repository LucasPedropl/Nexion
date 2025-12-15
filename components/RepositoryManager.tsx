import React, { useState, useEffect, useRef } from 'react';
import { Project } from '../types';
import { auth } from '../services/auth';
import { githubApi, GithubFile, GithubCommit } from '../services/githubService';
import { 
    FolderGit2, GitBranch, FileCode, ChevronRight, ChevronDown, 
    RefreshCw, GitCommit, FileText, Folder, ArrowLeft,
    AlertCircle, Save, Loader2, History, Code2, User
} from 'lucide-react';

interface RepositoryManagerProps {
    project: Project;
}

export const RepositoryManager: React.FC<RepositoryManagerProps> = ({ project }) => {
    const [selectedRepo, setSelectedRepo] = useState<string>('');
    const [branches, setBranches] = useState<string[]>([]);
    const [currentBranch, setCurrentBranch] = useState('main');
    
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
    
    // History State
    const [activeTab, setActiveTab] = useState<'code' | 'history'>('code');
    const [commits, setCommits] = useState<GithubCommit[]>([]);
    const [isLoadingCommits, setIsLoadingCommits] = useState(false);

    const user = auth.currentUser;

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
                const parts = selectedRepo.replace('https://github.com/', '').split('/');
                const owner = parts[0];
                const repo = parts[1];
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

    // Fetch Files
    useEffect(() => {
        if (!selectedRepo || !user?.githubToken) return;
        
        const loadFiles = async () => {
            setIsLoadingFiles(true);
            try {
                const parts = selectedRepo.replace('https://github.com/', '').split('/');
                const owner = parts[0];
                const repo = parts[1];
                const files = await githubApi.getContents(user.githubToken!, owner, repo, currentPath, currentBranch);
                
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
    }, [selectedRepo, currentBranch, currentPath, user]);

    // Load Commits if tab changes
    useEffect(() => {
        if (activeTab === 'history' && selectedRepo && user?.githubToken) {
            const loadCommits = async () => {
                setIsLoadingCommits(true);
                try {
                    const parts = selectedRepo.replace('https://github.com/', '').split('/');
                    const owner = parts[0];
                    const repo = parts[1];
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
                const parts = selectedRepo.replace('https://github.com/', '').split('/');
                const owner = parts[0];
                const repo = parts[1];
                const { content } = await githubApi.getFileContent(user?.githubToken!, owner, repo, file.path, currentBranch);
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

    const handleCommit = async () => {
        if (!selectedFile || !commitMessage || !user?.githubToken) return;
        setIsSaving(true);
        try {
            const parts = selectedRepo.replace('https://github.com/', '').split('/');
            const owner = parts[0];
            const repo = parts[1];
            
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
            // Re-select file to update SHA for next commit
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
            <div className="h-14 border-b border-base-800 flex items-center px-4 gap-4 bg-base-950/50 flex-shrink-0">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                    <FolderGit2 size={18} className="text-primary-400" />
                    <select 
                        value={selectedRepo}
                        onChange={(e) => {
                            setSelectedRepo(e.target.value);
                            setCurrentPath('');
                            setSelectedFile(null);
                        }}
                        className="bg-base-800 border border-base-700 rounded-lg px-3 py-1.5 text-xs text-base-text outline-none focus:border-primary-500 max-w-[200px]"
                    >
                        {project.githubRepos.map(r => (
                            <option key={r} value={r}>{r.replace('https://github.com/', '')}</option>
                        ))}
                    </select>

                    <div className="h-4 w-px bg-base-700 mx-2"></div>

                    <GitBranch size={16} className="text-base-muted" />
                    <select 
                        value={currentBranch}
                        onChange={(e) => setCurrentBranch(e.target.value)}
                        className="bg-transparent text-xs text-base-text outline-none cursor-pointer hover:text-primary-400"
                    >
                        {branches.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                </div>

                <div className="flex bg-base-800 rounded-lg p-1 border border-base-700">
                    <button 
                        onClick={() => setActiveTab('code')}
                        className={`px-3 py-1 text-xs font-medium rounded-md transition-all flex items-center gap-2 ${activeTab === 'code' ? 'bg-base-700 text-base-text shadow-sm' : 'text-base-muted hover:text-base-text'}`}
                    >
                        <Code2 size={14} /> Código
                    </button>
                    <button 
                        onClick={() => setActiveTab('history')}
                        className={`px-3 py-1 text-xs font-medium rounded-md transition-all flex items-center gap-2 ${activeTab === 'history' ? 'bg-base-700 text-base-text shadow-sm' : 'text-base-muted hover:text-base-text'}`}
                    >
                        <History size={14} /> Histórico
                    </button>
                </div>
            </div>

            {/* Main Content */}
            {activeTab === 'code' ? (
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
                                    {fileContent !== originalContent && (
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
            ) : (
                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                    {isLoadingCommits ? (
                        <div className="flex justify-center p-10"><Loader2 className="animate-spin text-primary-500" size={32}/></div>
                    ) : (
                        <div className="space-y-4 max-w-4xl mx-auto">
                            {commits.map(commit => (
                                <div key={commit.sha} className="bg-base-800 border border-base-700 rounded-xl p-4 flex gap-4 hover:border-primary-500/30 transition-colors">
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
                                            <span className="font-mono bg-base-950 px-1.5 py-0.5 rounded text-[10px]">{commit.sha.substring(0, 7)}</span>
                                        </div>
                                    </div>
                                    <a 
                                        href={commit.html_url} 
                                        target="_blank" 
                                        rel="noreferrer"
                                        className="self-center p-2 text-base-muted hover:text-base-text hover:bg-base-700 rounded-lg"
                                    >
                                        <ChevronRight size={16} />
                                    </a>
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
        </div>
    );
};