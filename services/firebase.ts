import { initializeApp } from 'firebase/app';
import {
	getFirestore,
	collection,
	getDocs,
	doc,
	setDoc,
	deleteDoc,
	query,
	where,
	updateDoc,
	getDoc,
	addDoc,
	documentId,
} from 'firebase/firestore';
import { Project, Notification, ProjectRole, TeamMember } from '../types';
import { User } from 'firebase/auth';

// Lê credenciais exclusivamente das variáveis de ambiente.
const firebaseConfig = {
	apiKey:
		(typeof import.meta !== 'undefined' &&
			(import.meta as any).env?.VITE_FIREBASE_API_KEY) ||
		(typeof process !== 'undefined'
			? process.env.VITE_FIREBASE_API_KEY
			: '') ||
		'',
	authDomain:
		(typeof import.meta !== 'undefined' &&
			(import.meta as any).env?.VITE_FIREBASE_AUTH_DOMAIN) ||
		(typeof process !== 'undefined'
			? process.env.VITE_FIREBASE_AUTH_DOMAIN
			: '') ||
		'',
	projectId:
		(typeof import.meta !== 'undefined' &&
			(import.meta as any).env?.VITE_FIREBASE_PROJECT_ID) ||
		(typeof process !== 'undefined'
			? process.env.VITE_FIREBASE_PROJECT_ID
			: '') ||
		'',
	storageBucket:
		(typeof import.meta !== 'undefined' &&
			(import.meta as any).env?.VITE_FIREBASE_STORAGE_BUCKET) ||
		(typeof process !== 'undefined'
			? process.env.VITE_FIREBASE_STORAGE_BUCKET
			: '') ||
		'',
	messagingSenderId:
		(typeof import.meta !== 'undefined' &&
			(import.meta as any).env?.VITE_FIREBASE_MESSAGING_SENDER_ID) ||
		(typeof process !== 'undefined'
			? process.env.VITE_FIREBASE_MESSAGING_SENDER_ID
			: '') ||
		'',
	appId:
		(typeof import.meta !== 'undefined' &&
			(import.meta as any).env?.VITE_FIREBASE_APP_ID) ||
		(typeof process !== 'undefined'
			? process.env.VITE_FIREBASE_APP_ID
			: '') ||
		'',
	measurementId:
		(typeof import.meta !== 'undefined' &&
			(import.meta as any).env?.VITE_FIREBASE_MEASUREMENT_ID) ||
		(typeof process !== 'undefined'
			? process.env.VITE_FIREBASE_MEASUREMENT_ID
			: '') ||
		'',
};

// Inicialização do Firebase
export let app: any;
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

export const getProjects = async (user: User): Promise<Project[]> => {
	if (!db || !user) {
		return [];
	}
	try {
		const projectsCol = collection(db, 'projects');

		// 1. Projetos que eu sou dono
		const myProjectsQuery = query(
			projectsCol,
			where('ownerId', '==', user.uid)
		);
		const myProjectsSnap = await getDocs(myProjectsQuery);

		// 2. Projetos onde sou membro (email)
		// Usamos o campo 'members' que é um array de emails simples para busca rápida
		const sharedQuery = query(
			projectsCol,
			where('members', 'array-contains', user.email)
		);
		const sharedSnap = await getDocs(sharedQuery);

		// Merge e deduplicate
		const allDocs = [...myProjectsSnap.docs, ...sharedSnap.docs];
		const uniqueProjects = new Map();

		allDocs.forEach((doc) => {
			const data = doc.data() as Project;

			// Normalizar estrutura antiga para nova
			let team = data.team || [];

			// Se não tiver team, mas tiver owner e members (antigo), migrar em tempo de execução para display
			if (team.length === 0) {
				// Adiciona dono (se não estiver na lista) - na verdade ownerId não está em members geralmente
				// Adiciona membros antigos como 'editor'
				if (data.members) {
					team = data.members.map((email) => ({
						email,
						role: 'editor',
						status: 'active',
						addedAt: Date.now(),
					}));
				}
			}

			const formattedProject: Project = {
				...data,
				icon: data.icon || 'code',
				subsystems: data.subsystems || ['Frontend', 'Backend'],
				roles: data.roles || ['Admin', 'User'],
				ownerId: data.ownerId || '',
				members: data.members || [],
				team: team,
				githubRepos: data.githubRepos || [], // Initialize repos
				githubOrg: data.githubOrg,
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
					type: d.type || 'flowchart',
				})),
			};
			uniqueProjects.set(formattedProject.id, formattedProject);
		});

		const projectList = Array.from(uniqueProjects.values());

		return projectList.sort((a, b) => {
			const orderA = a.order ?? 999999;
			const orderB = b.order ?? 999999;
			if (orderA !== orderB) return orderA - orderB;
			return b.createdAt - a.createdAt;
		});
	} catch (error) {
		console.error('Erro ao buscar projetos do Firebase:', error);
		return [];
	}
};

export const saveProject = async (project: Project): Promise<void> => {
	if (!db) return;
	try {
		const cleanProject = JSON.parse(JSON.stringify(project));
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

export const createInitialProject = (user: User): Project => {
	const userEmail = user.email || '';
	const userNick = (user as any).nickname;

	return {
		id: crypto.randomUUID(),
		name: 'Novo Projeto',
		description: 'Comece a organizar sua próxima grande ideia aqui.',
		tasks: [],
		notes: [],
		docs: [],
		diagrams: [],
		createdAt: Date.now(),
		order: 0,
		icon: 'rocket',
		subsystems: ['Frontend', 'Backend', 'Mobile'],
		roles: ['Admin', 'User', 'Guest'],
		ownerId: user.uid,
		githubRepos: [],
		members: [],
		team: [
			{
				email: userEmail,
				nickname: userNick,
				role: 'admin',
				status: 'active',
				addedAt: Date.now(),
			},
		],
	};
};

export const findUsersByGithubIds = async (
	githubIds: number[]
): Promise<any[]> => {
	if (!db || githubIds.length === 0) return [];
	try {
		const usersRef = collection(db, 'users');
		// Firestore 'in' query supports max 30 items. We need to batch.
		const chunks = [];
		for (let i = 0; i < githubIds.length; i += 30) {
			chunks.push(githubIds.slice(i, i + 30));
		}

		const results = [];
		for (const chunk of chunks) {
			const q = query(usersRef, where('githubId', 'in', chunk));
			const snapshot = await getDocs(q);
			snapshot.forEach((doc) => {
				results.push({ uid: doc.id, ...doc.data() });
			});
		}
		return results;
	} catch (e) {
		console.error('Erro ao buscar usuários por Github ID', e);
		return [];
	}
};

// --- NOTIFICATIONS & INVITES SYSTEM ---

export const getNotifications = async (
	userEmail: string
): Promise<Notification[]> => {
	if (!db || !userEmail) return [];
	try {
		const notifCol = collection(db, 'notifications');
		const q = query(notifCol, where('toEmail', '==', userEmail));
		const snapshot = await getDocs(q);

		const notifs = snapshot.docs.map((d) => ({
			...d.data(),
			id: d.id,
		})) as Notification[];
		return notifs.sort((a, b) => b.createdAt - a.createdAt);
	} catch (e) {
		console.error('Erro ao buscar notificações', e);
		return [];
	}
};

export const sendInvite = async (
	fromEmail: string,
	toEmail: string,
	projectId: string,
	projectName: string,
	role: ProjectRole,
	toNickname?: string
) => {
	if (!db) return;
	try {
		const notification: Omit<Notification, 'id'> = {
			type: 'invite',
			fromEmail,
			toEmail,
			projectId,
			projectName,
			role,
			status: 'unread',
			createdAt: Date.now(),
		};
		await addDoc(collection(db, 'notifications'), notification);

		const projectRef = doc(db, 'projects', projectId);
		const projectSnap = await getDoc(projectRef);

		if (projectSnap.exists()) {
			const projectData = projectSnap.data() as Project;
			const currentTeam = projectData.team || [];

			const existingMemberIndex = currentTeam.findIndex(
				(m) => m.email === toEmail
			);

			let updatedTeam = [...currentTeam];

			if (existingMemberIndex >= 0) {
				updatedTeam[existingMemberIndex] = {
					...updatedTeam[existingMemberIndex],
					role,
					status: 'pending',
					nickname:
						toNickname || updatedTeam[existingMemberIndex].nickname,
					addedAt: Date.now(),
				};
			} else {
				updatedTeam.push({
					email: toEmail,
					nickname: toNickname,
					role,
					status: 'pending',
					addedAt: Date.now(),
				});
			}

			await updateDoc(projectRef, { team: updatedTeam });
		}
	} catch (e) {
		console.error('Erro ao enviar convite', e);
		throw e;
	}
};

export const respondToInvite = async (
	notification: Notification,
	accept: boolean
) => {
	if (!db) return;
	try {
		const notifRef = doc(db, 'notifications', notification.id);
		await updateDoc(notifRef, {
			status: accept ? 'accepted' : 'rejected',
		});

		const projectRef = doc(db, 'projects', notification.projectId);
		const projectSnap = await getDoc(projectRef);

		if (projectSnap.exists()) {
			const projectData = projectSnap.data() as Project;
			let currentTeam = projectData.team || [];
			let currentMembers = projectData.members || [];

			if (accept) {
				const memberIndex = currentTeam.findIndex(
					(m) => m.email === notification.toEmail
				);

				let updatedTeam = [...currentTeam];
				if (memberIndex >= 0) {
					updatedTeam[memberIndex] = {
						...updatedTeam[memberIndex],
						status: 'active',
						role: notification.role,
					};
				} else {
					updatedTeam.push({
						email: notification.toEmail,
						role: notification.role,
						status: 'active',
						addedAt: Date.now(),
					});
				}

				if (!currentMembers.includes(notification.toEmail)) {
					currentMembers.push(notification.toEmail);
				}

				await updateDoc(projectRef, {
					team: updatedTeam,
					members: currentMembers,
				});
			} else {
				const updatedTeam = currentTeam.filter(
					(m) => m.email !== notification.toEmail
				);
				await updateDoc(projectRef, { team: updatedTeam });
			}
		}
	} catch (e) {
		console.error('Erro ao responder convite', e);
		throw e;
	}
};
