
import React, { useEffect, useRef, useState } from 'react';
import { WebContainer } from '@webcontainer/api';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';
import { 
    Loader2, Play, Square, Terminal as TerminalIcon, ExternalLink, 
    AlertTriangle, Smartphone, Tablet, Monitor, Maximize, Columns, 
    LayoutTemplate, RefreshCw, X
} from 'lucide-react';
import { githubApi } from '../services/githubService';
import { auth } from '../services/auth';

interface WebContainerPreviewProps {
    repoUrl: string;
    branch: string;
}

type DeviceMode = 'desktop' | 'tablet' | 'mobile';

export const WebContainerPreview: React.FC<WebContainerPreviewProps> = ({ repoUrl, branch }) => {
    const terminalRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null); // Ref para fullscreen
    
    // Engine State
    const [webContainer, setWebContainer] = useState<WebContainer | null>(null);
    const [isRunning, setIsRunning] = useState(false);
    const [previewUrl, setPreviewUrl] = useState<string>('');
    const [status, setStatus] = useState<string>('idle'); // idle, booting, cloning, installing, running
    const [error, setError] = useState<string | null>(null);
    
    // UI State
    const [deviceMode, setDeviceMode] = useState<DeviceMode>('desktop');
    const [showTerminal, setShowTerminal] = useState(true);
    
    // Terminal instances
    const xtermRef = useRef<Terminal | null>(null);
    const fitAddonRef = useRef<FitAddon | null>(null);

    // Process references
    const serverProcessRef = useRef<any>(null);

    const user = auth.currentUser;

    // 1. Initialize WebContainer
    useEffect(() => {
        const init = async () => {
            try {
                if (!webContainer) {
                    const wc = await WebContainer.boot();
                    setWebContainer(wc);
                    xtermRef.current?.write('\x1b[32m[System]\x1b[0m Container pronto. Aguardando comando.\r\n');
                }
            } catch (err: any) {
                console.error("WebContainer Boot Error:", err);
                setError("Falha ao iniciar ambiente virtual. Verifique se o navegador suporta WebContainers (COOP/COEP headers).");
            }
        };
        init();
        
        return () => {
            if (serverProcessRef.current) serverProcessRef.current.kill();
        };
    }, []);

    // 2. Initialize Terminal (Separate effect to handle DOM ref)
    useEffect(() => {
        if (terminalRef.current && !xtermRef.current) {
            const term = new Terminal({
                convertEol: true,
                fontFamily: 'Menlo, Monaco, "Courier New", monospace',
                fontSize: 12,
                theme: {
                    background: '#0f172a', // slate-900
                    foreground: '#e2e8f0', // slate-200
                    cursor: '#38bdf8'
                },
                rows: 24,
            });
            const fitAddon = new FitAddon();
            term.loadAddon(fitAddon);
            term.open(terminalRef.current);
            fitAddon.fit();
            
            xtermRef.current = term;
            fitAddonRef.current = fitAddon;
            
            term.write('\x1b[34m[System]\x1b[0m Inicializando terminal...\r\n');
        }
        
        // Refit on resize
        const handleResize = () => fitAddonRef.current?.fit();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [showTerminal]);

    // Refit when toggling terminal visibility
    useEffect(() => {
        if (showTerminal && fitAddonRef.current) {
            setTimeout(() => fitAddonRef.current?.fit(), 100);
        }
    }, [showTerminal]);

    const getRepoDetails = (url: string) => {
        const cleanUrl = url.replace('https://github.com/', '');
        const parts = cleanUrl.split('/');
        return { owner: parts[0], repo: parts[1] };
    };

    // 2. Clone and Setup Logic
    const handleDeploy = async () => {
        if (!webContainer || !user?.githubToken) return;
        
        setStatus('cloning');
        setError(null);
        setPreviewUrl('');
        setShowTerminal(true); // Force terminal open to show progress
        xtermRef.current?.clear();
        xtermRef.current?.write(`\x1b[34m[Deploy]\x1b[0m Iniciando deploy de ${repoUrl}...\r\n`);

        try {
            const { owner, repo } = getRepoDetails(repoUrl);
            
            // A. Fetch Tree
            const tree = await githubApi.getRepoTree(user.githubToken, owner, repo, branch);
            
            // Filter extensions
            const textExtensions = ['.js', '.jsx', '.ts', '.tsx', '.json', '.html', '.css', '.md', '.txt', '.lock', '.cjs', '.mjs', '.vue', '.svelte'];
            const fileSystemTree: any = {};
            let fileCount = 0;
            const MAX_FILES = 100;

            const addFileToTree = (pathParts: string[], content: string, currentTree: any) => {
                const name = pathParts[0];
                if (pathParts.length === 1) {
                    currentTree[name] = { file: { contents: content } };
                } else {
                    if (!currentTree[name]) currentTree[name] = { directory: {} };
                    addFileToTree(pathParts.slice(1), content, currentTree[name].directory);
                }
            };

            for (const item of tree) {
                if (item.type === 'blob') {
                    const isPackageJson = item.path.endsWith('package.json');
                    const isSource = textExtensions.some(ext => item.path.endsWith(ext));
                    
                    if (isPackageJson || isSource) {
                        if (fileCount >= MAX_FILES && !isPackageJson) continue;
                        xtermRef.current?.write(`\r\x1b[33m[Fetch]\x1b[0m Baixando ${item.path}...`);
                        const content = await githubApi.getBlob(user.githubToken, owner, repo, item.sha);
                        addFileToTree(item.path.split('/'), content, fileSystemTree);
                        fileCount++;
                    }
                }
            }

            xtermRef.current?.write(`\r\n\x1b[32m[Deploy]\x1b[0m Montando ${fileCount} arquivos...\r\n`);
            await webContainer.mount(fileSystemTree);

            // C. Install Dependencies
            setStatus('installing');
            xtermRef.current?.write(`\x1b[34m[NPM]\x1b[0m Instalando dependências...\r\n`);
            
            const installProcess = await webContainer.spawn('npm', ['install']);
            installProcess.output.pipeTo(new WritableStream({
                write(data) { xtermRef.current?.write(data); }
            }));

            const installExitCode = await installProcess.exit;
            if (installExitCode !== 0) throw new Error('Falha na instalação das dependências (exit code != 0).');

            xtermRef.current?.write(`\x1b[32m[NPM]\x1b[0m Instalação concluída.\r\n`);

            // D. Start Server
            startServer();

        } catch (e: any) {
            console.error(e);
            setError(e.message);
            xtermRef.current?.write(`\r\n\x1b[31m[Error]\x1b[0m ${e.message}\r\n`);
            setStatus('error');
        }
    };

    const startServer = async () => {
        if (!webContainer) return;
        
        setStatus('running');
        setIsRunning(true);
        xtermRef.current?.write(`\x1b[34m[System]\x1b[0m Iniciando servidor (npm run dev)...\r\n`);

        webContainer.on('server-ready', (port, url) => {
            xtermRef.current?.write(`\r\n\x1b[32m[System]\x1b[0m Servidor rodando: ${url}\r\n`);
            setPreviewUrl(url);
            setShowTerminal(false); // Auto hide terminal on success to focus on app
        });

        // Try 'dev' then 'start'
        serverProcessRef.current = await webContainer.spawn('npm', ['run', 'dev']);
        
        serverProcessRef.current.output.pipeTo(new WritableStream({
            write(data) { xtermRef.current?.write(data); }
        }));
    };

    const stopServer = () => {
        if (serverProcessRef.current) {
            serverProcessRef.current.kill();
            serverProcessRef.current = null;
        }
        setIsRunning(false);
        setStatus('idle');
        xtermRef.current?.write(`\r\n\x1b[33m[System]\x1b[0m Servidor parado.\r\n`);
    };

    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            containerRef.current?.requestFullscreen().catch(err => {
                alert(`Erro ao entrar em tela cheia: ${err.message}`);
            });
        } else {
            document.exitFullscreen();
        }
    };

    // Device Size Styles
    const getDeviceStyle = () => {
        switch(deviceMode) {
            case 'mobile': return { width: '375px', height: '100%', border: 'none', borderRadius: '0' }; // iPhone width
            case 'tablet': return { width: '768px', height: '100%', border: 'none', borderRadius: '0' }; // iPad width
            case 'desktop': 
            default: return { width: '100%', height: '100%' };
        }
    };

    const getWrapperStyle = () => {
        switch(deviceMode) {
            case 'mobile': return 'max-w-[395px] border-x-4 border-base-800 shadow-2xl bg-black'; 
            case 'tablet': return 'max-w-[788px] border-x-4 border-base-800 shadow-2xl bg-black'; 
            case 'desktop': return 'w-full h-full'; 
            default: return 'w-full h-full';
        }
    };

    return (
        <div ref={containerRef} className="flex flex-col h-full bg-base-950 text-base-text overflow-hidden relative">
            {/* Header / Controls */}
            <div className="h-14 border-b border-base-800 flex items-center justify-between px-4 bg-base-900 flex-shrink-0 z-20">
                <div className="flex items-center gap-3">
                    {/* Status & Deploy Button */}
                    {status === 'running' ? (
                        <button 
                            onClick={stopServer}
                            className="flex items-center gap-2 px-3 py-1.5 bg-red-900/30 text-red-400 hover:bg-red-900/50 border border-red-900/50 rounded-md text-xs font-medium transition-colors"
                        >
                            <Square size={14} fill="currentColor" /> Parar
                        </button>
                    ) : (
                        <button 
                            onClick={handleDeploy}
                            disabled={status !== 'idle' && status !== 'error'}
                            className="flex items-center gap-2 px-3 py-1.5 bg-primary-600 hover:bg-primary-500 text-white rounded-md text-xs font-medium transition-colors disabled:opacity-50"
                        >
                            {status === 'cloning' || status === 'installing' ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} fill="currentColor" />}
                            {status === 'idle' || status === 'error' ? 'Deploy' : '...'}
                        </button>
                    )}

                    {/* URL Display */}
                    {previewUrl && (
                        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-base-950 border border-base-800 rounded-md text-xs text-base-muted max-w-[200px]">
                            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                            <span className="truncate flex-1">{previewUrl}</span>
                            <a href={previewUrl} target="_blank" rel="noreferrer" className="hover:text-white"><ExternalLink size={12} /></a>
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    {/* Device Toggles */}
                    <div className="flex bg-base-800 rounded-lg p-1 border border-base-700 mr-2">
                        <button 
                            onClick={() => setDeviceMode('desktop')}
                            className={`p-1.5 rounded-md transition-all ${deviceMode === 'desktop' ? 'bg-base-600 text-white shadow-sm' : 'text-base-muted hover:text-base-text'}`}
                            title="Desktop"
                        >
                            <Monitor size={16} />
                        </button>
                        <button 
                            onClick={() => setDeviceMode('tablet')}
                            className={`p-1.5 rounded-md transition-all ${deviceMode === 'tablet' ? 'bg-base-600 text-white shadow-sm' : 'text-base-muted hover:text-base-text'}`}
                            title="Tablet"
                        >
                            <Tablet size={16} />
                        </button>
                        <button 
                            onClick={() => setDeviceMode('mobile')}
                            className={`p-1.5 rounded-md transition-all ${deviceMode === 'mobile' ? 'bg-base-600 text-white shadow-sm' : 'text-base-muted hover:text-base-text'}`}
                            title="Mobile"
                        >
                            <Smartphone size={16} />
                        </button>
                    </div>

                    {/* View Toggles */}
                    <button 
                        onClick={() => setShowTerminal(!showTerminal)}
                        className={`p-2 rounded-md border transition-colors ${showTerminal ? 'bg-primary-900/20 border-primary-500/30 text-primary-400' : 'bg-base-800 border-base-700 text-base-muted hover:text-base-text'}`}
                        title="Toggle Terminal"
                    >
                        <TerminalIcon size={16} />
                    </button>
                    
                    <button 
                        onClick={toggleFullscreen}
                        className="p-2 hover:bg-base-800 rounded-md text-base-muted hover:text-base-text transition-colors"
                        title="Tela Cheia"
                    >
                        <Maximize size={16} />
                    </button>
                </div>
            </div>

            {/* Main Area */}
            <div className="flex-1 flex overflow-hidden bg-base-200 relative">
                
                {/* PREVIEW AREA (Center/Left) */}
                <div className="flex-1 flex flex-col items-center justify-center bg-[#1e1e1e] relative overflow-hidden">
                    {/* Device Simulation Wrapper */}
                    <div className={`transition-all duration-300 ease-in-out relative flex flex-col overflow-hidden ${getWrapperStyle()}`}>
                        {previewUrl ? (
                            <iframe 
                                src={previewUrl} 
                                style={getDeviceStyle()}
                                className="bg-white mx-auto transition-all duration-300"
                                title="App Preview"
                                sandbox="allow-forms allow-modals allow-popups allow-presentation allow-same-origin allow-scripts"
                            />
                        ) : (
                            <div className="flex-1 w-full h-full flex flex-col items-center justify-center text-base-muted p-8 text-center">
                                {status === 'idle' ? (
                                    <>
                                        <div className="w-16 h-16 bg-base-800 rounded-2xl flex items-center justify-center mb-4 border border-base-700">
                                            <Play size={32} className="opacity-50" />
                                        </div>
                                        <p className="font-medium">Pronto para rodar</p>
                                        <p className="text-xs opacity-60 mt-1">Clique em Deploy para iniciar o ambiente Node.js</p>
                                    </>
                                ) : status === 'error' ? (
                                    <>
                                        <AlertTriangle size={48} className="text-red-500 mb-4" />
                                        <p className="text-red-400 font-medium">Erro na execução</p>
                                        <p className="text-xs mt-1 max-w-md">{error}</p>
                                    </>
                                ) : (
                                    <>
                                        <Loader2 size={48} className="animate-spin text-primary-500 mb-4" />
                                        <p className="font-medium animate-pulse">
                                            {status === 'cloning' ? 'Clonando repositório...' : 
                                             status === 'installing' ? 'Instalando dependências...' : 
                                             'Iniciando servidor...'}
                                        </p>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* TERMINAL AREA (Right Sidebar or Bottom) */}
                <div 
                    className={`border-l border-base-800 bg-[#0f172a] transition-all duration-300 flex flex-col ${
                        showTerminal ? 'w-[400px] translate-x-0' : 'w-0 translate-x-full border-l-0 overflow-hidden'
                    }`}
                >
                    <div className="h-8 bg-base-900 border-b border-base-800 flex items-center px-3 justify-between flex-shrink-0">
                        <span className="text-xs font-mono text-base-muted flex items-center gap-2">
                            <TerminalIcon size={12} /> Terminal Output
                        </span>
                        <button onClick={() => setShowTerminal(false)} className="text-base-muted hover:text-white">
                            <X size={12} />
                        </button>
                    </div>
                    <div className="flex-1 relative">
                        <div ref={terminalRef} className="absolute inset-0 p-2" />
                    </div>
                </div>

            </div>
            
            {/* Warning Banner if headers might be missing */}
            {!window.crossOriginIsolated && (
                <div className="absolute top-14 left-0 right-0 z-50 bg-amber-900/90 text-amber-100 text-xs p-2 text-center border-b border-amber-800 backdrop-blur-sm">
                    <p className="font-bold flex items-center justify-center gap-2">
                        <AlertTriangle size={14} />
                        Atenção: Headers de Segurança Ausentes
                    </p>
                    <span className="opacity-80">
                        O navegador bloqueou o SharedArrayBuffer. O WebContainer não funcionará sem 'Cross-Origin-Opener-Policy: same-origin'.
                    </span>
                </div>
            )}
        </div>
    );
};
