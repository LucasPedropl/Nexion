import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, FunctionDeclaration, Type } from '@google/genai';
import { Bot, Send, X, Minimize2, Terminal, Loader2 } from 'lucide-react';
import { Project, Task, TaskStatus } from '../types';

interface AiAssistantProps {
	project: Project;
	onUpdateProject: (p: Project) => void;
}

interface Message {
	role: 'user' | 'model' | 'system';
	content: string;
}

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
				'Olá! Sou seu assistente de projeto. Posso criar tarefas, escrever documentação, atualizar status ou mudar a descrição do projeto. Como posso ajudar?',
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
			name: 'update_project_description',
			description: 'Atualiza a descrição geral ou o resumo do projeto.',
			parameters: {
				type: Type.OBJECT,
				properties: {
					newDescription: {
						type: Type.STRING,
						description: 'A nova descrição completa do projeto.',
					},
				},
				required: ['newDescription'],
			},
		},
	];

	// --- EXECUTORES DAS FERRAMENTAS ---

	const executeFunction = (name: string, args: any): string => {
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

			// Só adiciona scope se tiver valor
			if (args.scope) newTask.scope = args.scope;

			onUpdateProject({ ...project, tasks: [newTask, ...project.tasks] });
			return `Tarefa criada com sucesso: ID ${newTask.id} - ${newTask.title}`;
		}

		if (name === 'update_task_status') {
			const task = project.tasks.find((t) => t.id === args.taskId);
			if (!task)
				return `Erro: Tarefa com ID ${args.taskId} não encontrada.`;

			const updatedTasks = project.tasks.map((t) =>
				t.id === args.taskId
					? { ...t, status: args.newStatus as TaskStatus }
					: t
			);
			onUpdateProject({ ...project, tasks: updatedTasks });
			return `Status da tarefa "${task.title}" atualizado para ${args.newStatus}.`;
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
			return `Documento "${newDoc.title}" criado com sucesso.`;
		}

		if (name === 'update_project_description') {
			onUpdateProject({ ...project, description: args.newDescription });
			return `Descrição do projeto atualizada com sucesso.`;
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
			const apiKey =
				(typeof import.meta !== 'undefined' &&
					(import.meta as any).env?.VITE_GEMINI_API_KEY) ||
				(typeof import.meta !== 'undefined' &&
					(import.meta as any).env?.GEMINI_API_KEY) ||
				(typeof process !== 'undefined'
					? process.env.VITE_GEMINI_API_KEY ||
					  process.env.GEMINI_API_KEY ||
					  process.env.API_KEY ||
					  ''
					: '');

			if (!apiKey) {
				throw new Error(
					'API key is missing. Please provide a valid API key.'
				);
			}

			const ai = new GoogleGenAI({ apiKey });

			// Preparar Contexto do Sistema com dados ATUAIS do projeto
			const projectContext = `
        PROJETO ATUAL: ${project.name}
        DESCRIÇÃO ATUAL: ${project.description}
        
        TAREFAS EXISTENTES (Use esses IDs para updates):
        ${project.tasks
			.map(
				(t) =>
					`- [${t.status}] ${t.title} (ID: ${t.id}, Prio: ${t.priority})`
			)
			.join('\n')}
        
        DOCUMENTOS EXISTENTES:
        ${project.docs.map((d) => `- ${d.title}`).join('\n')}

        INSTRUÇÃO: Você é um assistente de PM e Tech Lead. Responda de forma concisa.
        Sempre que o usuário pedir para mudar algo, chame a função apropriada.
      `;

			// Montar histórico simples para o prompt
			const prompt = `
        ${projectContext}
        
        Histórico recente:
        ${messages
			.slice(-4)
			.map((m) => `${m.role}: ${m.content}`)
			.join('\n')}
        user: ${userMsg}
      `;

			// Usando a nova API corretamente: ai.models.generateContent
			const response = await ai.models.generateContent({
				model: 'gemini-2.5-flash',
				contents: prompt,
				config: {
					systemInstruction:
						'Você é um assistente prestativo integrado ao app Nexion. Fale Português.',
					tools: [{ functionDeclarations: tools }],
				},
			});

			// Verificar chamadas de função (acesso via propriedade, não método)
			const functionCalls = response.functionCalls;

			if (functionCalls && functionCalls.length > 0) {
				let executionSummary = '';

				for (const call of functionCalls) {
					const fnName = call.name;
					const fnArgs = call.args;
					const output = executeFunction(fnName, fnArgs);
					executionSummary += output + '\n';
				}

				setMessages((prev) => [
					...prev,
					{ role: 'model', content: `Feito:\n${executionSummary}` },
				]);
			} else {
				// Resposta de texto normal (acesso via propriedade)
				const text = response.text;
				setMessages((prev) => [
					...prev,
					{
						role: 'model',
						content: text || 'Não entendi, pode repetir?',
					},
				]);
			}
		} catch (error) {
			console.error(error);
			setMessages((prev) => [
				...prev,
				{
					role: 'model',
					content:
						'Desculpe, tive um erro ao processar sua solicitação.',
				},
			]);
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
									Online
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
								placeholder="Crie uma tarefa, documente..."
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
								<Terminal size={10} /> Powered by Gemini
								Function Calling
							</span>
						</div>
					</div>
				</div>
			)}
		</>
	);
};
