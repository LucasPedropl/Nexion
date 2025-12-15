
export type TaskStatus = 'todo' | 'in-progress' | 'done';
export type TaskType = 'feature' | 'bug' | 'task';
export type TaskPriority = 'high' | 'medium' | 'low';

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  type: TaskType;
  priority: TaskPriority;
  scope?: string; // e.g., 'Frontend', 'Backend'
  role?: string; // e.g., 'Admin', 'User'
  createdAt: number;
  attachments?: string[]; // Base64 encoded images
}

export interface Documentation {
  id: string;
  title: string;
  content: string; // Markdown supported
  scope?: string; // e.g., 'Frontend'
  role?: string; // e.g., 'Admin'
  lastUpdated: number;
}

export interface ProjectNote {
  scope: string; // 'general', 'frontend', 'backend', etc.
  content: string;
  lastUpdated: number;
}

export type DiagramType = 
  | 'flowchart' 
  | 'sequence' 
  | 'class' 
  | 'er' 
  | 'useCase' 
  | 'state' 
  | 'gantt' 
  | 'mindmap';

export interface Diagram {
  id: string;
  title: string;
  type: DiagramType;
  code: string; // Mermaid code
  createdAt: number;
}

export type ProjectRole = 'admin' | 'editor' | 'viewer';

export interface TeamMember {
  email: string;
  nickname?: string; // Added nickname support
  role: ProjectRole;
  status: 'active' | 'pending' | 'removed';
  addedAt: number;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  tasks: Task[];
  notes: ProjectNote[] | string; // Support legacy string for migration
  docs: Documentation[];
  diagrams: Diagram[];
  
  // Architecture & Actors
  subsystems: string[]; // ['Frontend', 'Backend', 'Mobile', 'DevOps']
  roles: string[]; // ['Admin', 'Customer', 'Guest']
  
  // Auth & Collaboration
  ownerId: string; // UID do criador
  members: string[]; // Lista de emails simples para query rápida (array-contains) - APENAS ATIVOS
  team: TeamMember[]; // Lista detalhada com permissões (inclui pendentes e removidos)
  
  // Integrations
  githubRepos?: string[]; // URLs of connected repos

  createdAt: number;
  order?: number; // Custom display order
  icon: string;
}

export interface Notification {
  id: string;
  type: 'invite';
  fromEmail: string;
  toEmail: string;
  projectId: string;
  projectName: string;
  role: ProjectRole;
  status: 'unread' | 'read' | 'accepted' | 'rejected';
  createdAt: number;
}

export type ViewMode = 'dashboard' | 'project' | 'settings' | 'project-settings' | 'notifications';
export type ProjectTab = 'overview' | 'tasks' | 'board' | 'notes' | 'docs' | 'diagrams' | 'code';

export type ThemeId = 
  | 'cosmic' 
  | 'dracula' 
  | 'forest' 
  | 'ocean' 
  | 'sunset' 
  | 'light' 
  | 'black' 
  | 'cyberpunk'
  | 'high-contrast-dark'
  | 'high-contrast-light'
  | 'jungle'
  | 'blossom'
  | 'sky'
  | 'matrix'
  | 'supabase';

export interface Theme {
  id: ThemeId;
  name: string;
  colors: {
    primary: string;
    background: string;
  }
}
