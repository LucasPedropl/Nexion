import React, { ReactNode, useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { 
  LayoutDashboard, Plus, Settings as SettingsIcon, ChevronLeft, ChevronRight, 
  Hash, FolderGit2, Rocket, Cloud, Database, Globe, Smartphone, Code2, 
  Terminal, Cpu, Zap, Target, Shield, Anchor, Coffee, Music, Video, 
  Image as ImageIcon, Wifi, Battery, Sun, Moon, Gamepad2, MoreVertical,
  Edit2, SlidersHorizontal, Trash2
} from 'lucide-react';
import { Project, ViewMode } from '../types';

interface LayoutProps {
  children: ReactNode;
  projects: Project[];
  activeProjectId: string | null;
  currentView: ViewMode;
  onSelectProject: (id: string | null) => void;
  onAddProject: () => void;
  onOpenSettings: () => void;
  onOpenProjectSettings: (id: string) => void;
  onRequestRename: (project: Project) => void;
  onRequestDeleteProject: (id: string) => void;
  onReorderProjects?: (projects: Project[]) => void;
}

// Mapa de ícones expandido
export const iconMap: Record<string, any> = {
  'code': Code2,
  'rocket': Rocket,
  'database': Database,
  'cloud': Cloud,
  'globe': Globe,
  'mobile': Smartphone,
  'terminal': Terminal,
  'cpu': Cpu,
  'hash': Hash,
  'git': FolderGit2,
  'zap': Zap,
  'target': Target,
  'shield': Shield,
  'anchor': Anchor,
  'coffee': Coffee,
  'music': Music,
  'video': Video,
  'image': ImageIcon,
  'wifi': Wifi,
  'battery': Battery,
  'sun': Sun,
  'moon': Moon,
  'gamepad': Gamepad2
};

// Componente reutilizável para exibir ícone ou imagem
export const ProjectIconDisplay: React.FC<{ icon: string; className?: string; size?: number }> = ({ icon, className = "", size = 18 }) => {
  if (icon?.startsWith('data:image') || icon?.startsWith('http')) {
    return (
      <img 
        src={icon} 
        alt="icon" 
        className={`object-cover rounded-md flex-shrink-0 bg-white/10 ${className}`} 
        style={{ width: size, height: size }} 
      />
    );
  }
  
  const IconComponent = iconMap[icon] || FolderGit2;
  return <IconComponent size={size} className={className} />;
};

export const Layout: React.FC<LayoutProps> = ({ 
  children, 
  projects, 
  activeProjectId, 
  currentView,
  onSelectProject, 
  onAddProject,
  onOpenSettings,
  onOpenProjectSettings,
  onRequestRename,
  onRequestDeleteProject,
  onReorderProjects
}) => {
  // Inicializa o estado da sidebar a partir do localStorage
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('nexion_sidebar') === 'true';
    }
    return false;
  });

  // Multi-selection state
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
  const [lastClickedIndex, setLastClickedIndex] = useState<number | null>(null);

  // Context Menu State (Global position)
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, projectId: string } | null>(null);
  
  // Tooltip State
  const [hoveredTooltip, setHoveredTooltip] = useState<{ text: string, top: number, left: number } | null>(null);

  // Drag and Drop State
  const [draggedItemIndex, setDraggedItemIndex] = useState<number | null>(null);
  const [dragOverItemIndex, setDragOverItemIndex] = useState<number | null>(null);

  // Sync selection with active project initially or when active changes externally
  useEffect(() => {
    if (activeProjectId && !selectedProjectIds.includes(activeProjectId)) {
      if (selectedProjectIds.length === 0) {
        setSelectedProjectIds([activeProjectId]);
      }
    }
  }, [activeProjectId]);

  // Fecha o menu se clicar fora
  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);

  const toggleSidebar = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    localStorage.setItem('nexion_sidebar', String(newState));
  };

  const handleProjectClick = (e: React.MouseEvent, project: Project, index: number) => {
    // Determine Selection Logic
    let newSelectedIds = [...selectedProjectIds];

    if (e.shiftKey && lastClickedIndex !== null) {
      // Range Selection
      const start = Math.min(lastClickedIndex, index);
      const end = Math.max(lastClickedIndex, index);
      const rangeIds = projects.slice(start, end + 1).map(p => p.id);
      
      // Add range to existing selection (or replace, usually replace in file managers, but let's be inclusive)
      // Standard behavior: Shift+Click sets the selection to the range from anchor to focus.
      newSelectedIds = rangeIds;
    } else if (e.metaKey || e.ctrlKey) {
      // Toggle Selection
      if (newSelectedIds.includes(project.id)) {
        newSelectedIds = newSelectedIds.filter(id => id !== project.id);
      } else {
        newSelectedIds.push(project.id);
      }
    } else {
      // Single Selection
      newSelectedIds = [project.id];
    }

    setSelectedProjectIds(newSelectedIds);
    setLastClickedIndex(index);
    
    // Navigation (always navigate to the clicked one)
    onSelectProject(project.id);
  };

  const handleRenameClick = (e: React.MouseEvent, projectId: string) => {
    e.stopPropagation();
    const project = projects.find(p => p.id === projectId);
    if (project) {
      onRequestRename(project);
    }
    setContextMenu(null);
  };

  const handleSettingsClick = (e: React.MouseEvent, projectId: string) => {
    e.stopPropagation();
    onOpenProjectSettings(projectId);
    setContextMenu(null);
  };

  const handleDeleteClick = (e: React.MouseEvent, projectId: string) => {
    e.stopPropagation();
    onRequestDeleteProject(projectId);
    setContextMenu(null);
  };

  // Tooltip Handlers
  const handleMouseEnter = (e: React.MouseEvent, text: string) => {
    if (!isCollapsed) return;
    const rect = e.currentTarget.getBoundingClientRect();
    setHoveredTooltip({
      text,
      top: rect.top + (rect.height / 2),
      left: rect.right + 10 // 10px spacing
    });
  };

  const handleMouseLeave = () => {
    setHoveredTooltip(null);
  };

  const handleContextMenu = (e: React.MouseEvent, projectId: string) => {
    e.preventDefault();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      projectId
    });
  };

  // --- Drag and Drop Handlers ---
  const handleDragStart = (e: React.DragEvent, index: number, projectId: string) => {
    // If dragging an item that isn't selected, select it (and deselect others)
    if (!selectedProjectIds.includes(projectId)) {
      setSelectedProjectIds([projectId]);
      setLastClickedIndex(index);
    }
    setDraggedItemIndex(index);
    
    // Custom drag image could be set here to show badge of multiple items
    // const dragCount = selectedProjectIds.includes(projectId) ? selectedProjectIds.length : 1;
    // e.dataTransfer.setDragImage(...)
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault(); // Necessary to allow dropping
    setDragOverItemIndex(index);
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    
    if (draggedItemIndex === null) {
      setDragOverItemIndex(null);
      return;
    }

    if (onReorderProjects) {
      // Identify which items are being moved
      const draggingId = projects[draggedItemIndex].id;
      
      // If the dragged item is part of the selection, move the whole selection
      // Otherwise, just move the dragged item (fallback, though dragStart handles this)
      const idsToMove = selectedProjectIds.includes(draggingId) 
        ? selectedProjectIds 
        : [draggingId];

      const itemsToMove = projects.filter(p => idsToMove.includes(p.id));
      const remainingItems = projects.filter(p => !idsToMove.includes(p.id));

      // Calculate insertion point
      // We need to find where the target item ends up in the remaining list
      // Note: If we drop ON one of the selected items, usually nothing happens or it shifts.
      // Logic: Insert itemsToMove BEFORE the item currently at targetIndex (if moving down) or AFTER?
      
      // Simplification: We want to insert 'itemsToMove' at 'targetIndex'. 
      // However, 'targetIndex' refers to the original list.
      // We need to map targetIndex to the new list (remainingItems).
      
      const targetProject = projects[targetIndex];
      let insertIndex = remainingItems.findIndex(p => p.id === targetProject.id);
      
      if (insertIndex === -1) {
        // We dropped onto itself or one of the moving items. 
        // If we are reordering a group within itself, usually no-op, 
        // but if we are dropping the group onto a specific member of the group, it's ambiguous.
        // Let's assume dropping onto any member of the selection does nothing.
        setDraggedItemIndex(null);
        setDragOverItemIndex(null);
        return;
      }

      // If dragging downwards (targetIndex > draggedItemIndex of the primary item), 
      // we generally want to insert after. 
      // But standard splice behavior inserts 'at' index, pushing that item right.
      
      // If we are dropping below the source, we might need to adjust.
      // A simple way is: if targetIndex > draggedItemIndex, insert after.
      if (targetIndex > draggedItemIndex) {
         insertIndex = insertIndex + 1;
      }

      const newOrder = [
        ...remainingItems.slice(0, insertIndex),
        ...itemsToMove,
        ...remainingItems.slice(insertIndex)
      ];

      onReorderProjects(newOrder);
    }
    
    setDraggedItemIndex(null);
    setDragOverItemIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedItemIndex(null);
    setDragOverItemIndex(null);
  };

  return (
    <div className="flex h-screen bg-base-900 text-base-text overflow-hidden transition-colors duration-300">
      {/* Sidebar */}
      <aside 
        className={`${
          isCollapsed ? 'w-20' : 'w-64'
        } bg-base-950 border-r border-base-800 flex flex-col hidden md:flex transition-all duration-300 relative flex-shrink-0 z-20`}
      >
        {/* Header / Logo Area */}
        <div className={`p-6 border-b border-base-800 flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'} relative flex-shrink-0`}>
          <div className="w-8 h-8 bg-primary-500 rounded-lg flex items-center justify-center shadow-lg shadow-primary-500/20 flex-shrink-0">
            <LayoutDashboard size={18} className="text-white" />
          </div>
          
          {!isCollapsed && (
            <span className="font-bold text-xl tracking-tight text-base-text whitespace-nowrap overflow-hidden animate-in fade-in duration-300">
              Nexion
            </span>
          )}

          {/* Toggle Button */}
          <button 
            onClick={toggleSidebar}
            className="absolute -right-3 bottom-[-12px] w-6 h-6 bg-base-800 border border-base-700 hover:border-primary-500 text-base-muted hover:text-primary-400 rounded-lg flex items-center justify-center z-50 transition-colors shadow-md"
            title={isCollapsed ? "Expandir" : "Recolher"}
          >
            {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>
        </div>

        {/* Scrollable Area */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 custom-scrollbar flex flex-col">
          
          {/* Global Actions Group */}
          <div className="mb-2 space-y-1 flex-shrink-0">
            {/* Dashboard Link */}
            <div className="relative group">
              <button 
                onClick={() => {
                  onSelectProject(null);
                  setSelectedProjectIds([]);
                  setLastClickedIndex(null);
                }}
                onMouseEnter={(e) => handleMouseEnter(e, "Dashboard")}
                onMouseLeave={handleMouseLeave}
                className={`w-full flex items-center ${isCollapsed ? 'justify-center px-0' : 'px-3 gap-3'} py-2.5 rounded-md transition-all ${
                  currentView === 'dashboard'
                    ? 'bg-primary-500/10 text-primary-400' 
                    : 'hover:bg-base-900 text-base-muted hover:text-base-text'
                }`}
              >
                <LayoutDashboard size={20} className="flex-shrink-0" />
                {!isCollapsed && <span className="font-medium text-sm">Dashboard</span>}
              </button>
            </div>

            {/* New Project Button */}
            <div className="relative group">
               <button 
                onClick={onAddProject} 
                onMouseEnter={(e) => handleMouseEnter(e, "Novo Projeto")}
                onMouseLeave={handleMouseLeave}
                className={`w-full flex items-center ${isCollapsed ? 'justify-center px-0' : 'px-3 gap-3'} py-2.5 rounded-md transition-all text-base-muted hover:text-primary-400 hover:bg-base-900`}
              >
                <Plus size={20} className="flex-shrink-0" />
                {!isCollapsed && <span className="font-medium text-sm">Novo Projeto</span>}
              </button>
            </div>
          </div>

          {/* Divider */}
          <div className="h-px bg-base-800 my-2 w-full flex-shrink-0"></div>

          {/* Project List */}
          <div className="flex-1">
            {!isCollapsed && (
              <h3 className="px-3 mb-2 text-xs font-semibold text-base-muted uppercase tracking-wider flex items-center justify-between">
                <span>Projetos</span>
              </h3>
            )}

            <div className="space-y-1 pb-10">
              {projects.map((p, index) => {
                const isSelected = selectedProjectIds.includes(p.id);
                const isActive = activeProjectId === p.id && currentView !== 'project-settings';
                
                return (
                  <div 
                    key={p.id} 
                    className={`relative group ${
                      draggedItemIndex === index ? 'opacity-50' : 'opacity-100'
                    } ${
                      dragOverItemIndex === index && draggedItemIndex !== index ? 'border-t-2 border-primary-500 pt-1' : ''
                    }`}
                    draggable={true}
                    onDragStart={(e) => handleDragStart(e, index, p.id)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDrop={(e) => handleDrop(e, index)}
                    onDragEnd={handleDragEnd}
                  >
                    <div className="flex items-center">
                      <button
                        onClick={(e) => handleProjectClick(e, p, index)}
                        onContextMenu={(e) => handleContextMenu(e, p.id)}
                        onMouseEnter={(e) => handleMouseEnter(e, p.name)}
                        onMouseLeave={handleMouseLeave}
                        className={`relative flex-1 flex items-center ${isCollapsed ? 'justify-center px-0' : 'px-3 gap-3'} py-2 rounded-md text-sm transition-all overflow-hidden cursor-pointer ${
                          isActive
                            ? 'bg-base-800 text-base-text border-l-2 border-primary-500' 
                            : isSelected 
                              ? 'bg-base-800/50 text-base-text border-l-2 border-primary-500/30'
                              : 'text-base-muted hover:bg-base-900 hover:text-base-text border-l-2 border-transparent'
                        }`}
                      >
                        {/* Drag Handle (Visual cue on hover, though whole row is draggable) */}
                        {!isCollapsed && (
                          <div className="opacity-0 group-hover:opacity-30 absolute left-0.5 w-1 h-8 cursor-grab flex items-center justify-center">
                             <div className="w-0.5 h-4 bg-current rounded-full"></div>
                          </div>
                        )}

                        <div className={`${isActive ? 'text-primary-400' : ''} flex-shrink-0`}>
                          <ProjectIconDisplay icon={p.icon} size={18} />
                        </div>
                        {!isCollapsed && <span className="truncate flex-1 text-left select-none">{p.name}</span>}
                      </button>

                      {/* 3-Dots Menu Trigger (Visible on hover when open) */}
                      {!isCollapsed && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleContextMenu(e, p.id);
                          }}
                          className={`absolute right-1 p-1 rounded hover:bg-base-700 text-base-muted hover:text-base-text opacity-0 group-hover:opacity-100 transition-opacity ${contextMenu?.projectId === p.id ? 'opacity-100 bg-base-700' : ''}`}
                        >
                          <MoreVertical size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
              
              {projects.length === 0 && !isCollapsed && (
                <div className="px-4 py-4 text-xs text-base-muted italic">Nenhum projeto ainda.</div>
              )}
            </div>
          </div>
        </div>
        
        {/* Footer Area */}
        <div className={`p-3 border-t border-base-800 ${isCollapsed ? 'flex justify-center' : ''} bg-base-950 flex-shrink-0`}>
           <div className="relative group w-full">
            <button 
              onClick={onOpenSettings}
              onMouseEnter={(e) => handleMouseEnter(e, "Configurações")}
              onMouseLeave={handleMouseLeave}
              className={`w-full flex items-center ${isCollapsed ? 'justify-center px-0' : 'px-3 gap-3'} py-2.5 rounded-md transition-colors ${
                currentView === 'settings'
                  ? 'bg-primary-500/10 text-primary-400' 
                  : 'hover:bg-base-900 text-base-muted hover:text-base-text'
              }`}
            >
              <SettingsIcon size={20} className="flex-shrink-0" />
              {!isCollapsed && <span className="font-medium text-sm">Configurações</span>}
            </button>
           </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 bg-base-900 transition-colors duration-300 relative z-10 overflow-y-auto overflow-x-hidden custom-scrollbar">
        {children}
      </main>
      
      {/* Context Menu (Fixed Position via Portal-like logic) */}
      {contextMenu && (
        <div 
          className="fixed z-[9999] w-48 bg-base-800 border border-base-700 rounded-lg shadow-xl py-1 animate-in fade-in zoom-in-95 duration-100"
          style={{ 
            left: contextMenu.x, 
            top: contextMenu.y 
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Project Name Header */}
          <div className="px-4 py-2 border-b border-base-700 mb-1">
             <span className="text-xs font-semibold text-base-muted truncate block">
               {projects.find(p => p.id === contextMenu.projectId)?.name || 'Projeto'}
             </span>
          </div>

           <button 
            onClick={(e) => handleRenameClick(e, contextMenu.projectId)}
            className="w-full text-left px-4 py-2 text-sm text-base-muted hover:text-base-text hover:bg-base-700 flex items-center gap-2"
          >
            <Edit2 size={14} /> Renomear
          </button>
          <button 
            onClick={(e) => handleSettingsClick(e, contextMenu.projectId)}
            className="w-full text-left px-4 py-2 text-sm text-base-muted hover:text-base-text hover:bg-base-700 flex items-center gap-2"
          >
            <SlidersHorizontal size={14} /> Configurações
          </button>
          <div className="h-px bg-base-700 my-1"></div>
          <button 
            onClick={(e) => handleDeleteClick(e, contextMenu.projectId)}
            className="w-full text-left px-4 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-900/20 flex items-center gap-2"
          >
            <Trash2 size={14} /> Excluir
          </button>
        </div>
      )}

      {/* Tooltip Portal */}
      {isCollapsed && hoveredTooltip && ReactDOM.createPortal(
        <div 
          className="fixed z-[9999] px-2 py-1 bg-base-800 text-base-text text-xs rounded border border-base-700 shadow-xl pointer-events-none animate-in fade-in duration-150 flex items-center"
          style={{ 
            top: hoveredTooltip.top, 
            left: hoveredTooltip.left,
            transform: 'translateY(-50%)' 
          }}
        >
          {/* Arrow pointing left */}
          <div className="absolute -left-[6px] top-1/2 -translate-y-1/2 w-0 h-0 border-t-[6px] border-t-transparent border-b-[6px] border-b-transparent border-r-[6px] border-r-base-800"></div>
          {hoveredTooltip.text}
        </div>,
        document.body
      )}
    </div>
  );
};