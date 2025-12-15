
import { 
  getFirestore, 
  collection, 
  query, 
  where, 
  getDocs, 
  setDoc,
  doc,
  getDoc,
  limit,
  updateDoc
} from 'firebase/firestore';
import { 
  getAuth, 
  signInWithPopup, 
  GithubAuthProvider, 
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  signOut,
  User,
  linkWithPopup,
  getAdditionalUserInfo
} from 'firebase/auth';
import { app } from './firebase';

const db = getFirestore(app);
const firebaseAuth = getAuth(app);

// Definimos o tipo de usuário da aplicação explicitamente para garantir que as propriedades existam
export interface NexionUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  nickname?: string | null;
  githubToken?: string;
  githubId?: number;
  githubLogin?: string;
  isDevBypass?: boolean;
}

// Estado local de autenticação
let currentUser: NexionUser | null = JSON.parse(localStorage.getItem('nexion_user') || 'null');
const listeners: ((user: NexionUser | null) => void)[] = [];

const notifyListeners = () => {
  listeners.forEach(listener => listener(currentUser));
};

export const auth = {
  get currentUser() { return currentUser; }
};

// --- HELPER: USER PROFILE ---

export const checkNicknameAvailability = async (nickname: string) => {
    const normalized = nickname.toLowerCase().trim();
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where("nickname", "==", normalized));
    const snapshot = await getDocs(q);
    return snapshot.empty; // Retorna true se disponível
};

export const createUserProfile = async (uid: string, data: { email: string, displayName: string, nickname: string, photoURL?: string, githubId?: number, githubLogin?: string, githubToken?: string }) => {
    const normalizedNick = data.nickname.toLowerCase().trim();
    
    // Dupla verificação de nickname
    const isAvailable = await checkNicknameAvailability(normalizedNick);
    if (!isAvailable) {
        throw new Error("Este apelido já está em uso.");
    }

    // Prepara objeto para salvar
    const payload: any = {
        email: data.email,
        displayName: data.displayName,
        nickname: normalizedNick,
        photoURL: data.photoURL || "",
        createdAt: Date.now()
    };

    if (data.githubId) payload.githubId = data.githubId;
    if (data.githubLogin) payload.githubLogin = data.githubLogin;
    // Opcional: Salvar token no banco (Cuidado com segurança, idealmente criptografar ou só manter em sessão/localStorage)
    // Para este MVP vamos manter o token apenas localmente ou salvar se necessário para tarefas em background.
    // Vamos salvar para permitir recuperação em outros dispositivos, mas saiba que não é best practice production-grade.
    if (data.githubToken) payload.githubToken = data.githubToken;

    // Salva APENAS dados de perfil. NÃO salva senha.
    await setDoc(doc(db, 'users', uid), payload);

    // Atualiza estado local de imediato
    if (currentUser && currentUser.uid === uid) {
        currentUser.nickname = normalizedNick;
        currentUser.githubId = data.githubId;
        currentUser.githubLogin = data.githubLogin;
        currentUser.githubToken = data.githubToken;
        localStorage.setItem('nexion_user', JSON.stringify(currentUser));
        notifyListeners();
    }
};

export const getUserProfile = async (uid: string) => {
    const docRef = doc(db, 'users', uid);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
        return docSnap.data();
    }
    return null;
};

// --- PROVEDORES REAIS ---

const handleSocialLogin = async (provider: any) => {
    // Escopos para GitHub (se for o caso)
    if (provider instanceof GithubAuthProvider) {
        provider.addScope('repo'); 
        provider.addScope('read:org');
        provider.addScope('user');
    }

    const result = await signInWithPopup(firebaseAuth, provider);
    const user = result.user;
    
    // Obter dados extras do provider
    const additionalInfo = getAdditionalUserInfo(result);
    let token = undefined;
    let githubId = undefined;
    let githubLogin = undefined;

    // Tentar pegar token se for GitHub
    if (provider instanceof GithubAuthProvider) {
        const credential = GithubAuthProvider.credentialFromResult(result);
        token = credential?.accessToken;
        
        if (additionalInfo && additionalInfo.profile) {
            githubId = (additionalInfo.profile as any).id;
            githubLogin = (additionalInfo.profile as any).login;
        }
    }

    // Tenta buscar perfil existente no Firestore para pegar o nickname
    const userProfile = await getUserProfile(user.uid);

    // Se logou com GitHub, atualiza o Firestore com o GitHub ID se não tiver
    if (githubId && userProfile && !userProfile.githubId) {
        await updateDoc(doc(db, 'users', user.uid), {
            githubId,
            githubLogin,
            githubToken: token // Atualiza token fresco
        });
    }

    currentUser = {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
        nickname: userProfile?.nickname || null, // Se null, a UI vai forçar a criação
        githubToken: token || userProfile?.githubToken, // Usa o novo ou do banco
        githubId: githubId || userProfile?.githubId,
        githubLogin: githubLogin || userProfile?.githubLogin
    };

    localStorage.setItem('nexion_user', JSON.stringify(currentUser));
    notifyListeners();
    return currentUser;
};

export const signInWithGithub = () => handleSocialLogin(new GithubAuthProvider());
export const signInWithGoogle = () => handleSocialLogin(new GoogleAuthProvider());

export const linkGithubAccount = async () => {
    if (!firebaseAuth.currentUser) throw new Error("Usuário não autenticado.");
    
    const provider = new GithubAuthProvider();
    provider.addScope('repo');
    provider.addScope('read:org');
    provider.addScope('user');

    try {
        const result = await linkWithPopup(firebaseAuth.currentUser, provider);
        const credential = GithubAuthProvider.credentialFromResult(result);
        const token = credential?.accessToken;
        const additionalInfo = getAdditionalUserInfo(result);
        
        let githubId, githubLogin;
        if (additionalInfo && additionalInfo.profile) {
            githubId = (additionalInfo.profile as any).id;
            githubLogin = (additionalInfo.profile as any).login;
        }

        // Atualizar Firestore
        await updateDoc(doc(db, 'users', firebaseAuth.currentUser.uid), {
            githubId,
            githubLogin,
            githubToken: token
        });

        // Atualizar estado local
        if (currentUser) {
            currentUser.githubToken = token;
            currentUser.githubId = githubId;
            currentUser.githubLogin = githubLogin;
            localStorage.setItem('nexion_user', JSON.stringify(currentUser));
            notifyListeners();
        }

        return currentUser;
    } catch (error: any) {
        console.error("Erro ao vincular GitHub:", error);
        if (error.code === 'auth/credential-already-in-use') {
            throw new Error("Esta conta do GitHub já está vinculada a outro usuário.");
        }
        throw error;
    }
};

// --- EMAIL & SENHA (FIREBASE AUTH NATIVO) ---

export const registerWithEmail = async (email: string, pass: string, name: string, nickname: string) => {
  try {
    // 1. Criar Auth User no Firebase Authentication
    // NOTA: A senha é salva de forma segura apenas no Authentication, NÃO no Firestore.
    const userCredential = await createUserWithEmailAndPassword(firebaseAuth, email, pass);
    const user = userCredential.user;

    // 2. Atualizar Profile Básico
    await updateProfile(user, { displayName: name });

    // 3. Criar Objeto de Usuário Local COMPLETO imediatamente
    // Isso evita que o App.tsx renderize o estado "sem nickname" enquanto o Firestore processa.
    const newUserState: NexionUser = {
        uid: user.uid,
        email: user.email,
        displayName: name,
        nickname: nickname.toLowerCase(),
        photoURL: null
    };
    
    // Atualiza a variável local antes de chamar o Firestore para evitar race condition nos listeners
    currentUser = newUserState;
    localStorage.setItem('nexion_user', JSON.stringify(currentUser));

    // 4. Criar Documento no Firestore (Valida Nickname e salva dados públicos)
    await createUserProfile(user.uid, {
        email: user.email!,
        displayName: name,
        nickname: nickname,
        photoURL: ""
    });
    
    // Notifica listeners (App.tsx) apenas agora que tudo está pronto
    notifyListeners();
    return currentUser;

  } catch (error: any) {
    console.error("Erro no registro:", error);
    // Limpa estado local se falhar
    currentUser = null;
    localStorage.removeItem('nexion_user');
    notifyListeners();

    if (error.code === 'auth/email-already-in-use') throw new Error("Email já cadastrado.");
    if (error.message === "Este apelido já está em uso.") throw error;
    throw new Error("Erro ao criar conta. Tente novamente.");
  }
};

export const loginWithEmail = async (email: string, pass: string) => {
  try {
    const userCredential = await signInWithEmailAndPassword(firebaseAuth, email, pass);
    const user = userCredential.user;

    // Buscar dados extras (nickname, github)
    const userProfile = await getUserProfile(user.uid);

    currentUser = {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      nickname: userProfile?.nickname || null,
      photoURL: user.photoURL,
      githubToken: userProfile?.githubToken,
      githubId: userProfile?.githubId,
      githubLogin: userProfile?.githubLogin
    };

    localStorage.setItem('nexion_user', JSON.stringify(currentUser));
    notifyListeners();
    return currentUser;
  } catch (error: any) {
    console.error("Erro no login:", error);
    if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        throw new Error("Email ou senha incorretos.");
    }
    throw error;
  }
};

// --- FUNÇÕES MOCK / BYPASS ---

export const loginAsDev = async () => {
  const devUser: NexionUser = {
    uid: 'dev-bypass-id',
    email: 'dev@nexion.local',
    displayName: 'Dev Mode (Bypass)',
    nickname: 'dev_admin',
    photoURL: null,
    githubToken: 'mock-token-123',
    isDevBypass: true
  };

  currentUser = devUser;
  localStorage.setItem('nexion_user', JSON.stringify(currentUser));
  notifyListeners();
  return currentUser;
};

export const logout = async () => {
  try {
      await signOut(firebaseAuth);
  } catch (e) {
      // Ignorar erro se for usuário mock
  }
  currentUser = null;
  localStorage.removeItem('nexion_user');
  notifyListeners();
};

export const subscribeToAuth = (callback: (user: NexionUser | null) => void) => {
  listeners.push(callback);
  // Se já temos um listener, tentamos sincronizar o estado do Firebase Auth real se não for bypass
  if (!currentUser?.isDevBypass) {
      const unsub = firebaseAuth.onAuthStateChanged(async (user) => {
          if (user) {
              // Se já temos um usuário local com nickname e UID batendo,
              // evitamos buscar o perfil novamente imediatamente para não sobrescrever
              // o estado "quente" do registro com um estado "frio" (sem nickname) do Firestore.
              if (currentUser && currentUser.uid === user.uid && currentUser.nickname) {
                  callback(currentUser);
                  return;
              }

              const profile = await getUserProfile(user.uid);
              currentUser = {
                  uid: user.uid,
                  email: user.email,
                  displayName: user.displayName,
                  photoURL: user.photoURL,
                  nickname: profile?.nickname || null,
                  githubToken: profile?.githubToken,
                  githubId: profile?.githubId,
                  githubLogin: profile?.githubLogin
              };
          } else {
              currentUser = null;
          }
          // Atualiza localStorage para persistência entre refreshes da aba
          if (currentUser) localStorage.setItem('nexion_user', JSON.stringify(currentUser));
          else localStorage.removeItem('nexion_user');
          
          callback(currentUser);
      });
      return unsub;
  } else {
      callback(currentUser);
      return () => {};
  }
};

export const findUserByEmail = async (email: string) => {
  try {
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where("email", "==", email));
    const snapshot = await getDocs(q);
    if (!snapshot.empty) return { uid: snapshot.docs[0].id, ...snapshot.docs[0].data() };
    return null; 
  } catch (e) {
    console.error("Erro ao buscar usuário por email", e);
    return null;
  }
};

export const searchUsersByNickname = async (term: string) => {
    if (!term) return [];
    try {
        const usersRef = collection(db, 'users');
        const normalizedTerm = term.toLowerCase();
        
        const q = query(
            usersRef, 
            where("nickname", ">=", normalizedTerm),
            where("nickname", "<=", normalizedTerm + '\uf8ff'),
            limit(5)
        );
        
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                uid: doc.id,
                email: data.email,
                displayName: data.displayName,
                nickname: data.nickname,
                photoURL: data.photoURL
            };
        });
    } catch (e) {
        console.error("Erro ao buscar usuários por nickname", e);
        return [];
    }
};