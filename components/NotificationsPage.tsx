
import React, { useEffect, useState } from 'react';
import { getNotifications, respondToInvite } from '../services/firebase';
import { Notification } from '../types';
import { auth } from '../services/auth';
import { Bell, Check, X, Loader2, Mail } from 'lucide-react';

interface NotificationsPageProps {
    onInviteAccepted?: () => void;
}

export const NotificationsPage: React.FC<NotificationsPageProps> = ({ onInviteAccepted }) => {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [processingId, setProcessingId] = useState<string | null>(null);
    const currentUser = auth.currentUser;

    useEffect(() => {
        const fetch = async () => {
            if (currentUser?.email) {
                const data = await getNotifications(currentUser.email);
                setNotifications(data);
            }
            setIsLoading(false);
        };
        fetch();
    }, [currentUser]);

    const handleResponse = async (notification: Notification, accept: boolean) => {
        setProcessingId(notification.id);
        try {
            await respondToInvite(notification, accept);
            // Update UI locally
            setNotifications(prev => prev.map(n => 
                n.id === notification.id 
                    ? { ...n, status: accept ? 'accepted' : 'rejected' } 
                    : n
            ));
            
            // Trigger refresh in parent if accepted
            if (accept && onInviteAccepted) {
                onInviteAccepted();
            }
        } catch (error) {
            alert("Erro ao processar convite.");
        } finally {
            setProcessingId(null);
        }
    };

    return (
        <div className="flex-1 p-8 bg-base-900 text-base-text min-h-full">
            <div className="max-w-4xl mx-auto">
                <header className="mb-10 border-b border-base-700 pb-6">
                    <h1 className="text-3xl font-bold text-base-text mb-2 flex items-center gap-3">
                        <Bell className="text-primary-500" /> Notificações
                    </h1>
                    <p className="text-base-muted">Gerencie seus convites e alertas.</p>
                </header>

                {isLoading ? (
                    <div className="flex justify-center py-20">
                        <Loader2 className="animate-spin text-primary-500" size={32} />
                    </div>
                ) : (
                    <div className="space-y-4">
                        {notifications.length === 0 && (
                            <div className="text-center py-20 text-base-muted border-2 border-dashed border-base-800 rounded-xl">
                                <p>Você não tem notificações no momento.</p>
                            </div>
                        )}

                        {notifications.map(notif => (
                            <div 
                                key={notif.id} 
                                className={`p-5 rounded-xl border flex items-center justify-between transition-all ${
                                    notif.status === 'unread' 
                                        ? 'bg-base-800 border-primary-500/30 shadow-lg shadow-primary-900/10' 
                                        : 'bg-base-900 border-base-700 opacity-70'
                                }`}
                            >
                                <div className="flex items-start gap-4">
                                    <div className={`p-3 rounded-full ${notif.type === 'invite' ? 'bg-primary-900/30 text-primary-400' : 'bg-base-800'}`}>
                                        <Mail size={20} />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-base-text text-lg">
                                            Convite de Projeto
                                        </h3>
                                        <p className="text-base-muted text-sm mt-1">
                                            <span className="text-base-text font-medium">{notif.fromEmail}</span> convidou você para colaborar no projeto 
                                            <span className="text-primary-400 font-bold ml-1">{notif.projectName}</span> como 
                                            <span className="bg-base-700 px-2 py-0.5 rounded text-xs ml-1 uppercase">{notif.role === 'admin' ? 'Administrador' : notif.role === 'editor' ? 'Colaborador' : 'Leitor'}</span>.
                                        </p>
                                        <p className="text-xs text-base-muted mt-2 opacity-60">
                                            {new Date(notif.createdAt).toLocaleDateString()} às {new Date(notif.createdAt).toLocaleTimeString()}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3">
                                    {notif.status === 'unread' || notif.status === 'read' ? (
                                        <>
                                            {processingId === notif.id ? (
                                                <Loader2 className="animate-spin text-primary-500" />
                                            ) : (
                                                <>
                                                    <button 
                                                        onClick={() => handleResponse(notif, false)}
                                                        className="px-4 py-2 rounded-lg border border-base-600 text-base-muted hover:bg-base-800 hover:text-red-400 transition-colors text-sm font-medium flex items-center gap-2"
                                                    >
                                                        <X size={16} /> Recusar
                                                    </button>
                                                    <button 
                                                        onClick={() => handleResponse(notif, true)}
                                                        className="px-4 py-2 rounded-lg bg-primary-600 hover:bg-primary-500 text-white transition-colors text-sm font-medium flex items-center gap-2 shadow-lg shadow-primary-900/20"
                                                    >
                                                        <Check size={16} /> Aceitar
                                                    </button>
                                                </>
                                            )}
                                        </>
                                    ) : (
                                        <div className={`px-4 py-2 rounded-lg text-sm font-bold uppercase border ${
                                            notif.status === 'accepted' 
                                                ? 'bg-green-900/10 text-green-500 border-green-900/30' 
                                                : 'bg-red-900/10 text-red-500 border-red-900/30'
                                        }`}>
                                            {notif.status === 'accepted' ? 'Aceito' : 'Recusado'}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};
