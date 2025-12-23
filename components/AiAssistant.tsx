import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, FunctionDeclaration, Type } from '@google/genai';
import { Bot, Send, X, Minimize2, Terminal, Loader2 } from 'lucide-react';
import { Project, Task, TaskStatus } from '../types';
import { auth } from '../services/auth';
import { githubApi } from '../services/githubService';

interface AiAssistantProps {
	project: Project;
	onUpdateProject: (p: Project) => void;
}

interface Message {
	role: 'user' | 'model' | 'system';
	content: string;
}

// Modelo Definido - Versão Lite 2.0
const MODEL_NAME = 'gemini-2.0-flash-lite-preview-02-05';

export const AiAssistant: React.FC<AiAssistantProps> = ({
	project,
	onUpdateProject,
}) => {
	const [isOpen, setIsOpen] = useState(false);
	const [input, setInput] = useState('');
	const [messages, setMessages] = useState<Message[]>([
		{
			role: 'model',
			content:
				'Olá! Sou seu assistente de projeto. Posso gerenciar tarefas, docs e agora acessar seus REPOSITÓRIOS. Como posso ajudar?',
		},
	]);
	const [isLoading, setIsLoading] = useState(false);
	const scrollRef = useRef<HTMLDivElement>(null);

	// Scroll to bottom
	useEffect(() => {
		if (scrollRef.current) {
			scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
		}
	}, [messages, isOpen]);

	// --- HELPER DE RETRY PARA O CHAT ---
	const generateChatResponseWithRetry = async (
		aiClient: any,
		params: any,
		maxRetries = 3
	) => {
		for (let i = 0; i < maxRetries; i++) {
			try {
				return await aiClient.models.generateContent({
					model: MODEL_NAME,
					...params,
				});
			} catch (error: any) {
				// Erro 429 = Rate Limit (Muitas requisições)
				if (
					(error.status === 429 || error.code === 429) &&
					i < maxRetries - 1
				) {
					// Chat pode esperar um pouco mais
					const delay = 2000 * Math.pow(2, i);
					console.warn(
						`[AiAssistant] Limite atingido (429). Retentando em ${delay}ms...`
					);
					// Notifica o usuário visualmente que está demorando por causa do limite
					if (i === 0) {
						setMessages((prev) => [
							...prev,
							{
								role: 'system',
								content:
									'⏳ O servidor está cheio. Aguardando vaga para processar...',
							},
						]);
					}
					await new Promise((resolve) => setTimeout(resolve, delay));
					continue;
				}
				throw error;
			}
		}
	};

	// --- FERRAMENTAS (Function Declarations) ---

	const tools: FunctionDeclaration[] = [
		{
			name: 'create_task',
			description: 'Cria uma nova tarefa no projeto.',
			parameters: {
				type: Type.OBJECT,
				properties: {
					title: {
						type: Type.STRING,
						description: 'Título da tarefa',
					},
					description: {
						type: Type.STRING,
						description: 'Descrição detalhada',
					},
					priority: {
						type: Type.STRING,
						enum: ['low', 'medium', 'high'],
						description: 'Prioridade',
					},
					scope: {
						type: Type.STRING,
						description:
							'Escopo (ex: Frontend, Backend). Use null se não especificado.',
					},
				},
				required: ['title'],
			},
		},
		{
			name: 'update_task_status',
			description: 'Atualiza o status de uma tarefa existente.',
			parameters: {
				type: Type.OBJECT,
				properties: {
					taskId: {
						type: Type.STRING,
						description: 'O ID exato da tarefa',
					},
					newStatus: {
						type: Type.STRING,
						enum: ['todo', 'in-progress', 'done'],
						description: 'Novo status',
					},
				},
				required: ['taskId', 'newStatus'],
			},
		},
		{
			name: 'create_documentation',
			description: 'Cria um novo documento de especificação.',
			parameters: {
				type: Type.OBJECT,
				properties: {
					title: {
						type: Type.STRING,
						description: 'Título do documento',
					},
					content: {
						type: Type.STRING,
						description: 'Conteúdo do documento em Markdown',
					},
					scope: {
						type: Type.STRING,
						description: 'Escopo opcional',
					},
				},
				required: ['title', 'content'],
			},
		},
		{
			name: 'list_repo_files',
			description: 'Lista arquivos de um repositório conectado.',
			parameters: {
				type: Type.OBJECT,
				properties: {
					repoUrl: {
						type: Type.STRING,
						description:
							'URL completa do repositório (ex: https://github.com/owner/repo) ou apenas o nome se houver ambiguidade.',
					},
					path: {
						type: Type.STRING,
						description:
							'Caminho da pasta (opcional, padrão raiz).',
					},
				},
				required: ['repoUrl'],
			},
		},
		{
			name: 'read_repo_file',
			description: 'Lê o conteúdo de um arquivo no repositório.',
			parameters: {
				type: Type.OBJECT,
				properties: {
					repoUrl: {
						type: Type.STRING,
						description: 'URL do repositório.',
					},
					filePath: {
						type: Type.STRING,
						description: 'Caminho completo do arquivo.',
					},
				},
				required: ['repoUrl', 'filePath'],
			},
		},
		{
			name: 'commit_changes',
			description: 'Cria um commit com alterações em um arquivo.',
			parameters: {
				type: Type.OBJECT,
				properties: {
					repoUrl: {
						type: Type.STRING,
						description: 'URL do repositório.',
					},
					filePath: {
						type: Type.STRING,
						description: 'Caminho do arquivo.',
					},
					content: {
						type: Type.STRING,
						description: 'Novo conteúdo COMPLETO do arquivo.',
					},
					message: {
						type: Type.STRING,
						description: 'Mensagem do commit.',
					},
				},
				required: ['repoUrl', 'filePath', 'content', 'message'],
			},
		},
	];

	// --- EXECUTORES DAS FERRAMENTAS ---

	const executeFunction = async (
		name: string,
		args: any
	): Promise<string> => {
		console.log(`[AI Exec] ${name}`, args);

		if (name === 'create_task') {
			const newTask: Task = {
				id: crypto.randomUUID(),
				title: args.title,
				description: args.description || '',
				priority: args.priority || 'medium',
				status: 'todo',
				type: 'task',
				createdAt: Date.now(),
				attachments: [],
			};
			if (args.scope) newTask.scope = args.scope;
			onUpdateProject({ ...project, tasks: [newTask, ...project.tasks] });
			return `Tarefa criada: ID ${newTask.id} - ${newTask.title}`;
		}

		if (name === 'update_task_status') {
			const task = project.tasks.find((t) => t.id === args.taskId);
			if (!task) return `Erro: Tarefa ${args.taskId} não encontrada.`;
			const updatedTasks = project.tasks.map((t) =>
				t.id === args.taskId
					? { ...t, status: args.newStatus as TaskStatus }
					: t
			);
			onUpdateProject({ ...project, tasks: updatedTasks });
			return `Status atualizado para ${args.newStatus}.`;
		}

		if (name === 'create_documentation') {
			const newDoc = {
				id: crypto.randomUUID(),
				title: args.title,
				content: args.content,
				scope: args.scope || undefined,
				lastUpdated: Date.now(),
			};
			onUpdateProject({ ...project, docs: [...project.docs, newDoc] });
			return `Documento "${newDoc.title}" criado.`;
		}

		// --- GITHUB TOOLS ---
		const user = auth.currentUser;
		if (!user?.githubToken) return 'Erro: Usuário não conectado ao GitHub.';

		const getRepoDetails = (url: string) => {
			// Tenta encontrar match na lista do projeto ou usa direto
			const cleanUrl = url.includes('github.com')
				? url
				: project.githubRepos?.find((r) => r.includes(url)) || url;
			const parts = cleanUrl
				.replace('https://github.com/', '')
				.split('/');
			if (parts.length < 2) throw new Error('Repositório inválido.');
			return { owner: parts[0], repo: parts[1] };
		};

		if (name === 'list_repo_files') {
			try {
				const { owner, repo } = getRepoDetails(args.repoUrl);
				const files = await githubApi.getContents(
					user.githubToken,
					owner,
					repo,
					args.path || ''
				);
				return JSON.stringify(
					files.map((f) => ({
						name: f.name,
						type: f.type,
						path: f.path,
					}))
				);
			} catch (e: any) {
				return `Erro ao listar arquivos: ${e.message}`;
			}
		}

		if (name === 'read_repo_file') {
			try {
				const { owner, repo } = getRepoDetails(args.repoUrl);
				const { content } = await githubApi.getFileContent(
					user.githubToken,
					owner,
					repo,
					args.filePath
				);
				return `Conteúdo de ${args.filePath}:\n${content}`;
			} catch (e: any) {
				return `Erro ao ler arquivo: ${e.message}`;
			}
		}

		if (name === 'commit_changes') {
			try {
				const { owner, repo } = getRepoDetails(args.repoUrl);
				// Precisa do SHA atual para update
				let sha: string | undefined;
				try {
					const current = await githubApi.getFileContent(
						user.githubToken,
						owner,
						repo,
						args.filePath
					);
					sha = current.sha;
				} catch (e) {
					// Arquivo novo
				}

				await githubApi.updateFile(
					user.githubToken,
					owner,
					repo,
					args.filePath,
					args.content,
					args.message,
					sha
				);
				return `Sucesso! Arquivo ${args.filePath} atualizado/criado.`;
			} catch (e: any) {
				return `Erro ao commitar: ${e.message}`;
			}
		}

		return 'Função desconhecida.';
	};

	// --- INTEGRAÇÃO GEMINI ---

	const handleSend = async () => {
		if (!input.trim() || isLoading) return;

		const userMsg = input;
		setInput('');
		setMessages((prev) => [...prev, { role: 'user', content: userMsg }]);
		setIsLoading(true);

		try {
			// Resolve API key from Vite client env first, then fallback to process.env (injected at build)
			const resolvedKey =
				(import.meta as any).env?.VITE_GEMINI_API_KEY ||
				(process.env as any)?.API_KEY;
			const ai = new GoogleGenAI({ apiKey: resolvedKey });

			// Preparar Contexto
			const projectContext = `
                PROJETO: ${project.name}
                REPOSITÓRIOS CONECTADOS: ${
					project.githubRepos?.join(', ') || 'Nenhum'
				}
                TAREFAS: ${project.tasks.length}
            `;

			const prompt = `
                ${projectContext}
                Histórico:
                ${messages
					.slice(-4)
					.map((m) => `${m.role}: ${m.content}`)
					.join('\n')}
                user: ${userMsg}
            `;

			// Usando gemini-2.0-flash-lite com RETRY
			const response = await generateChatResponseWithRetry(ai, {
				contents: prompt,
				config: {
					systemInstruction:
						'Você é um Tech Lead AI. Use as ferramentas para ler código e gerenciar o projeto.',
					tools: [{ functionDeclarations: tools }],
				},
			});

			// Remove mensagem de "aguardando" se existir
			setMessages((prev) => prev.filter((m) => m.role !== 'system'));

			const functionCalls = response.functionCalls;

			if (functionCalls && functionCalls.length > 0) {
				let executionSummary = '';
				for (const call of functionCalls) {
					const output = await executeFunction(call.name, call.args);
					executionSummary += `[Exec ${call.name}]: ${output}\n`;
				}
				setMessages((prev) => [
					...prev,
					{ role: 'model', content: executionSummary },
				]);
			} else {
				setMessages((prev) => [
					...prev,
					{ role: 'model', content: response.text || '...' },
				]);
			}
		} catch (error) {
			console.error(error);
			setMessages((prev) =>
				prev
					.filter((m) => m.role !== 'system')
					.concat([
						{
							role: 'model',
							content:
								'O sistema de IA está sobrecarregado (Rate Limit 429). Tente novamente em alguns segundos.',
						},
					])
			);
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<>
			{/* Botão Flutuante */}
			{!isOpen && (
				<button
					onClick={() => setIsOpen(true)}
					className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-primary-600 hover:bg-primary-500 text-white rounded-full shadow-xl shadow-primary-900/30 flex items-center justify-center transition-all hover:scale-110 animate-in zoom-in duration-300"
				>
					<Bot size={28} />
					{/* Badge de novidade */}
					<span className="absolute -top-1 -right-1 flex h-3 w-3">
						<span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
						<span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
					</span>
				</button>
			)}

			{/* Janela do Chat */}
			{isOpen && (
				<div className="fixed bottom-6 right-6 z-50 w-full max-w-[380px] h-[600px] max-h-[80vh] flex flex-col bg-base-900 border border-base-700 rounded-2xl shadow-2xl animate-in slide-in-from-bottom-5 duration-300 overflow-hidden">
					{/* Header */}
					<div className="flex items-center justify-between p-4 bg-base-800 border-b border-base-700">
						<div className="flex items-center gap-3">
							<div className="w-8 h-8 rounded-lg bg-primary-600 flex items-center justify-center text-white">
								<Bot size={18} />
							</div>
							<div>
								<h3 className="font-bold text-sm text-base-text">
									Nexion AI
								</h3>
								<p className="text-[10px] text-primary-400 flex items-center gap-1">
									<span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
									Online (Lite 2.0)
								</p>
							</div>
						</div>
						<div className="flex items-center gap-1">
							<button
								onClick={() => setIsOpen(false)}
								className="p-1.5 hover:bg-base-700 rounded-md text-base-muted hover:text-base-text transition-colors"
							>
								<Minimize2 size={16} />
							</button>
							<button
								onClick={() => setIsOpen(false)}
								className="p-1.5 hover:bg-base-700 rounded-md text-base-muted hover:text-base-text transition-colors"
							>
								<X size={16} />
							</button>
						</div>
					</div>

					{/* Area de Mensagens */}
					<div
						className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-base-950/50"
						ref={scrollRef}
					>
						{messages.map((msg, idx) => (
							<div
								key={idx}
								className={`flex w-full ${
									msg.role === 'user'
										? 'justify-end'
										: 'justify-start'
								}`}
							>
								<div
									className={`max-w-[85%] p-3 rounded-2xl text-sm leading-relaxed ${
										msg.role === 'user'
											? 'bg-primary-600 text-white rounded-tr-none'
											: msg.role === 'system'
											? 'bg-amber-900/30 text-amber-200 border border-amber-800/50 text-xs text-center w-full'
											: 'bg-base-800 border border-base-700 text-base-text rounded-tl-none'
									}`}
								>
									<div className="whitespace-pre-wrap">
										{msg.content}
									</div>
								</div>
							</div>
						))}
						{isLoading && (
							<div className="flex justify-start">
								<div className="bg-base-800 border border-base-700 p-3 rounded-2xl rounded-tl-none flex items-center gap-2 text-base-muted text-sm">
									<Loader2
										size={14}
										className="animate-spin"
									/>
									<span>Processando...</span>
								</div>
							</div>
						)}
					</div>

					{/* Input */}
					<div className="p-3 bg-base-800 border-t border-base-700">
						<form
							onSubmit={(e) => {
								e.preventDefault();
								handleSend();
							}}
							className="relative flex items-center gap-2"
						>
							<input
								autoFocus
								type="text"
								value={input}
								onChange={(e) => setInput(e.target.value)}
								placeholder="Gerar commit, ler arquivo..."
								className="flex-1 bg-base-900 border border-base-700 rounded-xl px-4 py-3 text-sm text-base-text focus:outline-none focus:border-primary-500 transition-colors pr-10"
							/>
							<button
								type="submit"
								disabled={!input.trim() || isLoading}
								className="absolute right-2 p-1.5 bg-primary-600 hover:bg-primary-500 text-white rounded-lg disabled:opacity-50 disabled:bg-base-700 transition-colors"
							>
								<Send size={16} />
							</button>
						</form>
						<div className="mt-2 flex gap-2 justify-center">
							<span className="text-[10px] text-base-muted flex items-center gap-1 opacity-60">
								<Terminal size={10} /> GitHub Tools Active
							</span>
						</div>
					</div>
				</div>
			)}
		</>
	);
};
