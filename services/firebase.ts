
import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, doc, setDoc, deleteDoc } from "firebase/firestore";
import { Project } from '../types';

/**
 * CONFIGURAÇÃO DO FIREBASE
 * Tenta usar variáveis de ambiente primeiro (segurança ideal).
 * Se não existirem, usa as chaves hardcoded para garantir que a demo funcione.
 */
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY || "AIzaSyCaKnXYzQ7IIVz8M54ay6B9fxq07rXAC_s",
  authDomain: process.env.FIREBASE_AUTH_DOMAIN || "nexion-4f615.firebaseapp.com",
  projectId: process.env.FIREBASE_PROJECT_ID || "nexion-4f615",
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "nexion-4f615.firebasestorage.app",
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || "1064132429996",
  appId: process.env.FIREBASE_APP_ID || "1:1064132429996:web:70f6014fd17986b6373709",
  measurementId: process.env.FIREBASE_MEASUREMENT_ID || "G-TSE6GK8RB3"
};

// Inicialização do Firebase
let app;
let db: any;

try {
  app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  console.log("Firebase conectado com sucesso ao projeto:", firebaseConfig.projectId);
} catch (error) {
  console.error("Erro crítico ao inicializar Firebase:", error);
}

// --- SERVIÇOS DO FIRESTORE ---

export const getProjects = async (): Promise<Project[]> => {
  if (!db) {
    console.warn("Firestore não está inicializado, retornando lista vazia.");
    return [];
  }
  try {
    const projectsCol = collection(db, 'projects');
    const projectSnapshot = await getDocs(projectsCol);
    const projectList = projectSnapshot.docs.map(doc => {
      const data = doc.data() as Project;
      // Garante que projetos antigos tenham campos padrão
      return { 
        ...data, 
        icon: data.icon || 'code',
        subsystems: data.subsystems || ['Frontend', 'Backend'],
        roles: data.roles || ['Admin', 'User'],
        notes: typeof data.notes === 'string' 
          ? [{ scope: 'general', content: data.notes, lastUpdated: Date.now() }] 
          : (data.notes || []),
        diagrams: (data.diagrams || []).map(d => ({
          ...d,
          type: d.type || 'flowchart' // Default type for legacy diagrams
        }))
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
    console.error("Erro ao buscar projetos do Firebase:", error);
    return [];
  }
};

export const saveProject = async (project: Project): Promise<void> => {
  if (!db) {
    console.warn("Firestore não inicializado, não foi possível salvar o projeto.");
    return;
  }
  try {
    // Firestore não aceita 'undefined'. Removemos campos undefined antes de salvar.
    // O jeito mais simples e seguro para objetos puros (sem functions) é JSON stringify/parse.
    const cleanProject = JSON.parse(JSON.stringify(project));
    
    // setDoc com merge: true ou sobrescrita direta. 
    await setDoc(doc(db, "projects", project.id), cleanProject);
  } catch (error) {
    console.error("Erro ao salvar projeto no Firebase:", error);
    throw error;
  }
};

export const deleteProject = async (projectId: string): Promise<void> => {
  if (!db) return;
  try {
    await deleteDoc(doc(db, "projects", projectId));
  } catch (error) {
    console.error("Erro ao excluir projeto do Firebase:", error);
    throw error;
  }
};

export const createInitialProject = (): Project => ({
  id: crypto.randomUUID(),
  name: "Novo Projeto",
  description: "Comece a organizar sua próxima grande ideia aqui.",
  tasks: [],
  notes: [], // Initialize as array
  docs: [],
  diagrams: [],
  createdAt: Date.now(),
  order: 0, // Put new projects at the top by default (or manage logic in App)
  icon: "rocket",
  subsystems: ['Frontend', 'Backend', 'Mobile'],
  roles: ['Admin', 'User', 'Guest']
});
