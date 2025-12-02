

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

export interface Project {
  id: string;
  name: string;
  description: string;
  tasks: Task[];
  notes: ProjectNote[] | string; // Support legacy string for migration
  docs: Documentation[];
  
  // Architecture & Actors
  subsystems: string[]; // ['Frontend', 'Backend', 'Mobile', 'DevOps']
  roles: string[]; // ['Admin', 'Customer', 'Guest']
  
  createdAt: number;
  order?: number; // Custom display order
  icon: string;
}

export type ViewMode = 'dashboard' | 'project' | 'settings' | 'project-settings';
export type ProjectTab = 'overview' | 'tasks' | 'board' | 'notes' | 'docs';

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