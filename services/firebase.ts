import { initializeApp } from 'firebase/app';
import {
	getFirestore,
	collection,
	getDocs,
	doc,
	setDoc,
	deleteDoc,
} from 'firebase/firestore';
import { Project } from '../types';

// Lê credenciais do ambiente (Vite no cliente usa import.meta.env com prefixo VITE_)
const firebaseConfig = {
	apiKey:
		(typeof import.meta !== 'undefined' &&
			(import.meta as any).env?.VITE_FIREBASE_API_KEY) ||
		(typeof process !== 'undefined'
			? process.env.VITE_FIREBASE_API_KEY
			: ''),
	authDomain:
		(typeof import.meta !== 'undefined' &&
			(import.meta as any).env?.VITE_FIREBASE_AUTH_DOMAIN) ||
		(typeof process !== 'undefined'
			? process.env.VITE_FIREBASE_AUTH_DOMAIN
			: ''),
	projectId:
		(typeof import.meta !== 'undefined' &&
			(import.meta as any).env?.VITE_FIREBASE_PROJECT_ID) ||
		(typeof process !== 'undefined'
			? process.env.VITE_FIREBASE_PROJECT_ID
			: ''),
	storageBucket:
		(typeof import.meta !== 'undefined' &&
			(import.meta as any).env?.VITE_FIREBASE_STORAGE_BUCKET) ||
		(typeof process !== 'undefined'
			? process.env.VITE_FIREBASE_STORAGE_BUCKET
			: ''),
	messagingSenderId:
		(typeof import.meta !== 'undefined' &&
			(import.meta as any).env?.VITE_FIREBASE_MESSAGING_SENDER_ID) ||
		(typeof process !== 'undefined'
			? process.env.VITE_FIREBASE_MESSAGING_SENDER_ID
			: ''),
	appId:
		(typeof import.meta !== 'undefined' &&
			(import.meta as any).env?.VITE_FIREBASE_APP_ID) ||
		(typeof process !== 'undefined'
			? process.env.VITE_FIREBASE_APP_ID
			: ''),
	measurementId:
		(typeof import.meta !== 'undefined' &&
			(import.meta as any).env?.VITE_FIREBASE_MEASUREMENT_ID) ||
		(typeof process !== 'undefined'
			? process.env.VITE_FIREBASE_MEASUREMENT_ID
			: ''),
};

// Inicialização do Firebase
let app;
let db: any;

const missingKeys = Object.entries(firebaseConfig)
	.filter(([_, value]) => !value)
	.map(([key]) => key);

if (missingKeys.length) {
	console.error(
		'Firebase não inicializado: faltam variáveis de ambiente:',
		missingKeys.join(', ')
	);
} else {
	try {
		app = initializeApp(firebaseConfig);
		db = getFirestore(app);
		console.log(
			'Firebase conectado com sucesso ao projeto:',
			firebaseConfig.projectId
		);
	} catch (error) {
		console.error('Erro crítico ao inicializar Firebase:', error);
	}
}

// --- SERVIÇOS DO FIRESTORE ---

export const getProjects = async (): Promise<Project[]> => {
	if (!db) {
		console.warn(
			'Firestore não está inicializado, retornando lista vazia.'
		);
		return [];
	}
	try {
		const projectsCol = collection(db, 'projects');
		const projectSnapshot = await getDocs(projectsCol);
		const projectList = projectSnapshot.docs.map((doc) => {
			const data = doc.data() as Project;
			// Garante que projetos antigos tenham campos padrão
			return {
				...data,
				icon: data.icon || 'code',
				subsystems: data.subsystems || ['Frontend', 'Backend'],
				roles: data.roles || ['Admin', 'User'],
				notes:
					typeof data.notes === 'string'
						? [
								{
									scope: 'general',
									content: data.notes,
									lastUpdated: Date.now(),
								},
						  ]
						: data.notes || [],
				diagrams: (data.diagrams || []).map((d) => ({
					...d,
					type: d.type || 'flowchart', // Default type for legacy diagrams
				})),
			};
		});

		// Ordenar por 'order' (crescente) e depois por 'createdAt' (decrescente) como fallback
		return projectList.sort((a, b) => {
			const orderA = a.order ?? 999999;
			const orderB = b.order ?? 999999;

			if (orderA !== orderB) {
				return orderA - orderB;
			}
			return b.createdAt - a.createdAt;
		});
	} catch (error) {
		console.error('Erro ao buscar projetos do Firebase:', error);
		return [];
	}
};

export const saveProject = async (project: Project): Promise<void> => {
	if (!db) {
		console.warn(
			'Firestore não inicializado, não foi possível salvar o projeto.'
		);
		return;
	}
	try {
		// Firestore não aceita 'undefined'. Removemos campos undefined antes de salvar.
		// O jeito mais simples e seguro para objetos puros (sem functions) é JSON stringify/parse.
		const cleanProject = JSON.parse(JSON.stringify(project));

		// setDoc com merge: true ou sobrescrita direta.
		await setDoc(doc(db, 'projects', project.id), cleanProject);
	} catch (error) {
		console.error('Erro ao salvar projeto no Firebase:', error);
		throw error;
	}
};

export const deleteProject = async (projectId: string): Promise<void> => {
	if (!db) return;
	try {
		await deleteDoc(doc(db, 'projects', projectId));
	} catch (error) {
		console.error('Erro ao excluir projeto do Firebase:', error);
		throw error;
	}
};

export const createInitialProject = (): Project => ({
	id: crypto.randomUUID(),
	name: 'Novo Projeto',
	description: 'Comece a organizar sua próxima grande ideia aqui.',
	tasks: [],
	notes: [], // Initialize as array
	docs: [],
	diagrams: [],
	createdAt: Date.now(),
	order: 0, // Put new projects at the top by default (or manage logic in App)
	icon: 'rocket',
	subsystems: ['Frontend', 'Backend', 'Mobile'],
	roles: ['Admin', 'User', 'Guest'],
});
