import { GoogleGenAI, Type } from '@google/genai';
import { Task, DiagramType } from '../types';

// Prefer Vite client env (VITE_) and do not bundle local credentials
const geminiApiKey =
	(typeof import.meta !== 'undefined' &&
		(import.meta as any).env?.VITE_GEMINI_API_KEY) ||
	(typeof import.meta !== 'undefined' &&
		(import.meta as any).env?.GEMINI_API_KEY) ||
	(typeof process !== 'undefined'
		? process.env.VITE_GEMINI_API_KEY ||
		  process.env.GEMINI_API_KEY ||
		  process.env.API_KEY
		: '') ||
	'';

const ai = geminiApiKey ? new GoogleGenAI({ apiKey: geminiApiKey }) : null;

// Instrução do sistema para guiar a persona do modelo
const SYSTEM_INSTRUCTION = `Você é um gerente de projetos técnicos experiente e especialista em documentação para desenvolvedores de software. 
Seu objetivo é analisar notas de reuniões desestruturadas e transformá-las em itens acionáveis e documentação técnica estruturada. Responda sempre em Português do Brasil.`;

export const analyzeNotesToTasks = async (
	notes: string,
	contextScope: string = 'general',
	availableScopes: string[] = [],
	availableRoles: string[] = []
): Promise<Partial<Task>[]> => {
	if (!geminiApiKey || !ai) {
		console.warn('Nenhuma API Key fornecida para o Gemini.');
		return [];
	}

	try {
		const scopesStr =
			availableScopes.length > 0 ? availableScopes.join(', ') : 'Geral';
		const rolesStr =
			availableRoles.length > 0 ? availableRoles.join(', ') : 'Qualquer';

		const prompt = `
      Contexto Atual de Foco: "${contextScope}".
      
      IMPORTANTE: Siga estritamente as listas de referência abaixo para categorizar as tarefas.
      - Escopos/Subsistemas válidos: [${scopesStr}]
      - Atores/Roles válidos: [${rolesStr}]

      Instrução:
      Analise as notas abaixo e extraia tarefas. Se houver múltiplas ações em uma frase envolvendo diferentes áreas ou atores, CRIE TAREFAS SEPARADAS.
      
      Regras de Mapeamento:
      1. Campo 'scope': Se o texto mencionar palavras como "no front", "na tela", "visual" -> tente mapear para 'Frontend' (ou similar na lista de escopos). Se mencionar "api", "banco", "servidor" -> mapeie para 'Backend' (ou similar).
      2. Campo 'role': Se o texto disser quem executa ou para quem é a feature (ex: "o admin valida", "o cliente vê") -> mapeie EXATAMENTE para um item da lista de Atores válidos.
      3. Se não encontrar correspondência exata, deixe em branco.
      
      Notas para análise:
      "${notes}"
    `;

		const response = await ai.models.generateContent({
			model: 'gemini-2.5-flash',
			contents: prompt,
			config: {
				systemInstruction: SYSTEM_INSTRUCTION,
				responseMimeType: 'application/json',
				responseSchema: {
					type: Type.ARRAY,
					items: {
						type: Type.OBJECT,
						properties: {
							title: {
								type: Type.STRING,
								description:
									'Título conciso da tarefa em Português',
							},
							description: {
								type: Type.STRING,
								description: 'Descrição técnica detalhada',
							},
							type: {
								type: Type.STRING,
								enum: ['feature', 'bug', 'task'],
							},
							priority: {
								type: Type.STRING,
								enum: ['high', 'medium', 'low'],
							},
							status: {
								type: Type.STRING,
								enum: ['todo'],
								description: 'Sempre definir como todo',
							},
							scope: {
								type: Type.STRING,
								description:
									'O subsistema técnico exato da lista fornecida',
								nullable: true,
							},
							role: {
								type: Type.STRING,
								description: 'O ator exato da lista fornecida',
								nullable: true,
							},
						},
						required: ['title', 'type', 'status', 'priority'],
					},
				},
			},
		});

		if (response.text) {
			const data = JSON.parse(response.text);
			return data.map((item: any) => ({
				...item,
				id: crypto.randomUUID(),
				createdAt: Date.now(),
				// Se a IA não definiu escopo, usa o contexto atual (se não for 'general')
				scope:
					item.scope ||
					(contextScope === 'general' ? undefined : contextScope),
				role: item.role || undefined,
			}));
		}
		return [];
	} catch (error) {
		console.error('Erro na extração de tarefas com Gemini:', error);
		throw error;
	}
};

export const refineDocumentation = async (
	roughDraft: string
): Promise<string> => {
	if (!geminiApiKey || !ai) return roughDraft;

	try {
		const response = await ai.models.generateContent({
			model: 'gemini-2.5-flash',
			contents: `Reescreva e formate o seguinte rascunho de documentação em Markdown limpo e profissional.
      Use cabeçalhos, marcadores e blocos de código onde apropriado para facilitar a leitura por desenvolvedores.
      Mantenha o texto em Português do Brasil.
      
      Rascunho:
      "${roughDraft}"`,
			config: {
				systemInstruction: SYSTEM_INSTRUCTION,
			},
		});

		return response.text || roughDraft;
	} catch (error) {
		console.error('Erro no refinamento de doc com Gemini:', error);
		return roughDraft;
	}
};

export const generateDiagramCode = async (
	userPrompt: string,
	projectContext: string,
	diagramType: DiagramType = 'flowchart'
): Promise<string> => {
	if (!geminiApiKey || !ai) return '';

	const diagramTypeInstruction = {
		flowchart: 'Use "graph TD" ou "graph LR".',
		sequence: 'Use "sequenceDiagram".',
		class: 'Use "classDiagram".',
		er: 'Use "erDiagram".',
		useCase:
			'Use "useCaseDiagram" (se suportado) ou "graph TD" simulando estrutura de casos de uso.',
		state: 'Use "stateDiagram-v2".',
		gantt: 'Use "gantt".',
		mindmap: 'Use "mindmap".',
	};

	try {
		const prompt = `
      CONTEXTO DO PROJETO:
      ${projectContext}

      SOLICITAÇÃO DO USUÁRIO:
      ${userPrompt}

      TIPO DE DIAGRAMA: ${diagramType}
      INSTRUÇÃO ESPECÍFICA: ${diagramTypeInstruction[diagramType]}

      TAREFA:
      Crie um diagrama usando a sintaxe MERMAID.JS que atenda à solicitação do usuário e respeite o tipo solicitado.
      Retorne APENAS o código Mermaid puro. Não use blocos de código markdown (\`\`\`). Não inclua explicações.
      
      Exemplo de Saída Esperada (se for Flowchart):
      graph TD
        A[Start] --> B{Is it?}
        B -- Yes --> C[OK]
        C --> D[Rethink]
        D --> B
        B -- No --> E[End]
    `;

		const response = await ai.models.generateContent({
			model: 'gemini-2.5-flash',
			contents: prompt,
			config: {
				systemInstruction:
					'Você é um especialista em Mermaid.js e arquitetura de software.',
				temperature: 0.2,
			},
		});

		let code = response.text || '';
		// Limpar blocos de código markdown se o modelo insistir em colocá-los
		code = code
			.replace(/```mermaid/g, '')
			.replace(/```/g, '')
			.trim();
		return code;
	} catch (error) {
		console.error('Erro ao gerar diagrama Mermaid:', error);
		return '';
	}
};
