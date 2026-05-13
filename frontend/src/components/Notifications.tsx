import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, X, Check } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContentWrapper, DropdownMenuItem, DropdownMenuTriggerButton } from '@/components/ui/form-controls';
import type { Notification } from '@/types';

export function Notifications() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: notificationsData } = useQuery<{ data: Notification[], pagination: any }>({
    queryKey: ['notifications'],
    queryFn: () => api.get('/notifications').then((r) => r.data),
    refetchInterval: 60000, // Refetch every minute
  });
  const notifications = notificationsData?.data || [];

  const { data: unreadCount } = useQuery<{ count: number }>({
    queryKey: ['notifications', 'unread-count'],
    queryFn: () => api.get('/notifications/unread-count').then((r) => r.data),
    refetchInterval: 60000,
  });

  const markAsReadMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/notifications/${id}/read`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
      qc.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
    },
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: () => api.patch('/notifications/mark-all-read'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
      qc.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/notifications/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
      qc.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
    },
  });

  const handleMarkAsRead = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    markAsReadMutation.mutate(id);
  };

  const handleMarkAllAsRead = () => {
    markAllAsReadMutation.mutate();
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Supprimer cette notification ?')) {
      deleteMutation.mutate(id);
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.read) {
      markAsReadMutation.mutate(notification.id);
    }
    if (notification.link) {
      window.location.href = notification.link;
    }
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTriggerButton asChild>
        <Button variant="ghost" size="icon" className="relative text-white hover:bg-white/15 hover:text-white">
          <Bell size={20} />
          {unreadCount && unreadCount.count > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
              {unreadCount.count > 9 ? '9+' : unreadCount.count}
            </span>
          )}
        </Button>
      </DropdownMenuTriggerButton>
      <DropdownMenuContentWrapper align="end" className="w-80 max-h-96 overflow-y-auto">
        <div className="p-2 border-b flex justify-between items-center">
          <span className="font-semibold text-sm">Notifications</span>
          {notifications.some(n => !n.read) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleMarkAllAsRead}
              disabled={markAllAsReadMutation.isPending}
              className="text-xs"
            >
              Tout marquer comme lu
            </Button>
          )}
        </div>
        {notifications.length === 0 ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            Aucune notification
          </div>
        ) : (
          notifications.map((notification) => (
            <div
              key={notification.id}
              className={`p-3 border-b hover:bg-muted cursor-pointer transition-colors ${
                !notification.read ? 'bg-muted/50' : ''
              }`}
              onClick={() => handleNotificationClick(notification)}
            >
              <div className="flex justify-between items-start gap-2">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{notification.title}</p>
                  {notification.content && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {notification.content}
                    </p>
                  )}
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {new Date(notification.createdAt).toLocaleDateString('fr-FR', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
                <div className="flex gap-1">
                  {!notification.read && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={(e) => handleMarkAsRead(notification.id, e)}
                    >
                      <Check size={12} />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={(e) => handleDelete(notification.id, e)}
                  >
                    <X size={12} />
                  </Button>
                </div>
              </div>
            </div>
          ))
        )}
      </DropdownMenuContentWrapper>
    </DropdownMenu>
  );
}
