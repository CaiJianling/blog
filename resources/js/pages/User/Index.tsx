import { Head, router, usePage } from '@inertiajs/react';
import {
    Pencil,
    Trash2,
    UserPlus,
    Search,
    X,
    Users,
    Loader2,
} from 'lucide-react';
import { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { LiquidSwitch } from '@/components/LiquidGlass/LiquidSwitch';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { useEffects } from '@/hooks/use-effects';

type UserRole = 'subscriber' | 'contributor' | 'author' | 'editor' | 'administrator';

interface User {
    id: number;
    name: string;
    email: string;
    email_verified_at: string;
    role: UserRole;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

interface Props {
    users: User[];
    breadcrumbs?: Array<{ title: string; href: string }>;
}

const ROLES: { value: UserRole; label: string }[] = [
    { value: 'subscriber', label: 'userManagement.roles.subscriber' },
    { value: 'contributor', label: 'userManagement.roles.contributor' },
    { value: 'author', label: 'userManagement.roles.author' },
    { value: 'editor', label: 'userManagement.roles.editor' },
    { value: 'administrator', label: 'userManagement.roles.administrator' },
];

const ROLE_COLORS: Record<UserRole, 'default' | 'outline' | 'destructive' | 'secondary'> = {
    subscriber: 'outline',
    contributor: 'secondary',
    author: 'default',
    editor: 'default',
    administrator: 'destructive',
};

export default function UserIndex({ users: serverUsers, breadcrumbs = [] }: Props) {
    const { t } = useTranslation();
    const { auth, errors, flash } = usePage().props as any;
    const currentUserId = auth?.user?.id;

    useEffect(() => {
        if (flash?.error) {
            console.error('Error:', flash.error);
        }

        if (flash?.success) {
            console.log('Success:', flash.success);
        }
    }, [flash]);

    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [deletingUserId, setDeletingUserId] = useState<number | null>(null);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [form, setForm] = useState({
        name: '',
        email: '',
        password: '',
        role: 'subscriber' as UserRole,
        is_active: true,
    });
    const [createErrors, setCreateErrors] = useState<Record<string, string>>({});
    const [editErrors, setEditErrors] = useState<Record<string, string>>({});
    const [isCreateSubmitting, setIsCreateSubmitting] = useState(false);
    const [isEditSubmitting, setIsEditSubmitting] = useState(false);
    const [localUsers, setLocalUsers] = useState(serverUsers);

    useEffect(() => {
        setLocalUsers(serverUsers);
    }, [serverUsers]);

    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<
        'all' | 'active' | 'inactive'
    >('all');
    const [roleFilter, setRoleFilter] = useState<UserRole | 'all'>('all');
    const { effectsEnabled } = useEffects();

    const StatusSwitch = ({ checked, onCheckedChange, disabled }: {
        checked: boolean;
        onCheckedChange: (checked: boolean) => void;
        disabled?: boolean;
    }) => {
        if (effectsEnabled) {
            return (
                <LiquidSwitch
                    checked={checked}
                    onChange={onCheckedChange}
                    size="sm"
                    disabled={disabled}
                />
            );
        }

        return (
            <Switch
                checked={checked}
                onCheckedChange={onCheckedChange}
                disabled={disabled}
            />
        );
    };

    const handleDelete = (userId: number) => {
        setDeletingUserId(userId);
        setIsDeleteDialogOpen(true);
    };

    const confirmDelete = () => {
        if (deletingUserId) {
            router.delete(`/users/${deletingUserId}`, {
                onSuccess: () => {
                    setIsDeleteDialogOpen(false);
                    setDeletingUserId(null);
                },
            });
        }
    };

    const cancelDelete = () => {
        setIsDeleteDialogOpen(false);
        setDeletingUserId(null);
    };

    const openEditDialog = (user: User) => {
        setEditingUser(user);
        setForm({
            name: user.name,
            email: user.email,
            password: '',
            role: user.role,
            is_active: user.is_active,
        });
        setIsEditDialogOpen(true);
    };

    const closeEditDialog = () => {
        setIsEditDialogOpen(false);
        setEditingUser(null);
        setForm({
            name: '',
            email: '',
            password: '',
            role: 'subscriber',
            is_active: true,
        });
        setEditErrors({});
    };

    const handleEditDialogOpenChange = (open: boolean) => {
        if (!open && !isEditSubmitting) {
            closeEditDialog();
        }
    };

    const openCreateDialog = () => {
        setForm({
            name: '',
            email: '',
            password: '',
            role: 'subscriber',
            is_active: true,
        });
        setCreateErrors({});
        setIsCreateDialogOpen(true);
    };

    const closeCreateDialog = () => {
        setIsCreateDialogOpen(false);
        setForm({
            name: '',
            email: '',
            password: '',
            role: 'subscriber',
            is_active: true,
        });
        setCreateErrors({});
    };

    const handleCreateDialogOpenChange = (open: boolean) => {
        if (!open && !isCreateSubmitting) {
            closeCreateDialog();
        }
    };

    const handleEditSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (editingUser) {
            setEditErrors({});
            router.put(`/users/${editingUser.id}`, form, {
                onStart: () => setIsEditSubmitting(true),
                onFinish: () => setIsEditSubmitting(false),
                onSuccess: () => closeEditDialog(),
                onError: (errors) => {
                    setEditErrors(errors as Record<string, string>);
                },
            });
        }
    };

    const handleCreateSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setCreateErrors({});
        router.post('/users', form, {
            onStart: () => setIsCreateSubmitting(true),
            onFinish: () => setIsCreateSubmitting(false),
            onSuccess: () => closeCreateDialog(),
            onError: (errors) => {
                setCreateErrors(errors as Record<string, string>);
            },
        });
    };

    const toggleStatus = (userId: number) => {
        const prevUsers = localUsers;
        const newActive = !prevUsers.find((u) => u.id === userId)?.is_active;

        // 乐观更新：立即切换 UI 状态
        setLocalUsers((users) =>
            users.map((u) =>
                u.id === userId ? { ...u, is_active: newActive } : u,
            ),
        );

        router.put(
            `/users/${userId}/toggle-status`,
            {},
            {
                preserveScroll: true,
                onError: () => {
                    // 请求失败：回退到之前的状态（动画自然退回）
                    setLocalUsers(prevUsers);
                },
            },
        );
    };

    const filteredUsers = useMemo(() => {
        return localUsers.filter((user) => {
            const matchesSearch =
                searchTerm === '' ||
                user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                user.email.toLowerCase().includes(searchTerm.toLowerCase());

            const matchesStatus =
                statusFilter === 'all' ||
                (statusFilter === 'active' && user.is_active) ||
                (statusFilter === 'inactive' && !user.is_active);

            const matchesRole =
                roleFilter === 'all' ||
                user.role === roleFilter;

            return matchesSearch && matchesStatus && matchesRole;
        });
    }, [localUsers, searchTerm, statusFilter, roleFilter]);

    const clearSearch = () => {
        setSearchTerm('');
    };

    return (
        <>
            <Head title={t('userManagement.title')} />
            <div className="flex h-full flex-1 flex-col gap-4 overflow-x-auto rounded-xl p-4">
                <div className="flex items-center justify-between">
                    <h1 className="text-2xl font-bold">
                        {t('userManagement.title')}
                    </h1>
                    <div className="flex items-center gap-4">
                        <Button onClick={openCreateDialog}>
                            <UserPlus className="mr-2 h-4 w-4" />
                            {t('userManagement.addUser')}
                        </Button>
                    </div>
                </div>

                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="relative max-w-md flex-1">
                        <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform text-muted-foreground" />
                        <Input
                            type="text"
                            placeholder={t('userManagement.searchPlaceholder')}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pr-10 pl-10"
                        />
                        {searchTerm && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={clearSearch}
                                className="absolute top-1/2 right-1 h-7 w-7 -translate-y-1/2 transform p-0"
                            >
                                <X className="h-3 w-3" />
                            </Button>
                        )}
                    </div>

                    <div className="flex gap-2">
                        <Select value={statusFilter} onValueChange={(value) =>
                            setStatusFilter(value as 'all' | 'active' | 'inactive')
                        }>
                            <SelectTrigger className="w-[140px]">
                                <SelectValue placeholder={t('userManagement.allStatus')} />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">
                                    {t('userManagement.allStatus')}
                                </SelectItem>
                                <SelectItem value="active">
                                    {t('userManagement.active')}
                                </SelectItem>
                                <SelectItem value="inactive">
                                    {t('userManagement.inactive')}
                                </SelectItem>
                            </SelectContent>
                        </Select>

                        <Select value={roleFilter} onValueChange={(value) =>
                            setRoleFilter(value as UserRole | 'all')
                        }>
                            <SelectTrigger className="w-[160px]">
                                <SelectValue placeholder={t('userManagement.allRoles')} />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">
                                    {t('userManagement.allRoles')}
                                </SelectItem>
                                {ROLES.map((role) => (
                                    <SelectItem key={role.value} value={role.value}>
                                        {t(role.label)}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {errors.error && (
                    <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
                        {errors.error}
                    </div>
                )}

                <Card className="flex-1">
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle>
                                    {t('userManagement.users')}
                                </CardTitle>
                                <CardDescription>
                                    {t('userManagement.manageUsers')}
                                </CardDescription>
                            </div>
                            <div className="text-sm text-muted-foreground">
                                {t('userManagement.usersCount', {
                                    filtered: filteredUsers.length,
                                    total: localUsers.length,
                                })}
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/50">
                                    <TableHead className="h-10 px-4">
                                        {t('userManagement.name')}
                                    </TableHead>
                                    <TableHead className="h-10 px-4">
                                        {t('userManagement.email')}
                                    </TableHead>
                                    <TableHead className="h-10 px-4">
                                        {t('userManagement.role')}
                                    </TableHead>
                                    <TableHead className="h-10 px-4">
                                        {t('userManagement.status')}
                                    </TableHead>
                                    <TableHead className="h-10 px-4">
                                        {t('userManagement.created')}
                                    </TableHead>
                                    <TableHead className="h-10 px-4 text-right">
                                        {t('userManagement.actions')}
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredUsers.length === 0 ? (
                                    <TableRow>
                                        <TableCell
                                            colSpan={6}
                                            className="py-8 text-center text-muted-foreground"
                                        >
                                            {searchTerm ||
                                            statusFilter !== 'all' ||
                                            roleFilter !== 'all' ? (
                                                <div className="flex flex-col items-center gap-2">
                                                    <Search className="h-8 w-8 text-muted-foreground/50" />
                                                    <p>
                                                        {t(
                                                            'userManagement.noUsersFound',
                                                        )}
                                                    </p>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => {
                                                            setSearchTerm('');
                                                            setStatusFilter(
                                                                'all',
                                                            );
                                                            setRoleFilter(
                                                                'all',
                                                            );
                                                        }}
                                                    >
                                                        {t(
                                                            'userManagement.clearFilters',
                                                        )}
                                                    </Button>
                                                </div>
                                            ) : (
                                                <div className="flex flex-col items-center gap-2">
                                                    <Users className="h-8 w-8 text-muted-foreground/50" />
                                                    <p>
                                                        {t(
                                                            'userManagement.noUsers',
                                                        )}
                                                    </p>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={openCreateDialog}
                                                    >
                                                        {t(
                                                            'userManagement.addFirstUser',
                                                        )}
                                                    </Button>
                                                </div>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredUsers.map((user) => (
                                        <TableRow
                                            key={user.id}
                                            className="border-b border-border/50 transition-colors hover:bg-muted/30"
                                        >
                                            <TableCell className="px-4 py-3 font-medium">
                                                {user.name}
                                            </TableCell>
                                            <TableCell className="px-4 py-3">
                                                {user.email}
                                            </TableCell>
                                            <TableCell className="px-4 py-3">
                                                <Badge
                                                    variant={ROLE_COLORS[user.role]}
                                                    className="px-2 py-1"
                                                >
                                                    {t(`userManagement.roles.${user.role}`)}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="px-4 py-3">
                                                <StatusSwitch
                                                    checked={user.is_active}
                                                    onCheckedChange={() =>
                                                        toggleStatus(user.id)
                                                    }
                                                    disabled={user.id === currentUserId}
                                                />
                                            </TableCell>
                                            <TableCell className="px-4 py-3">
                                                {new Date(
                                                    user.created_at,
                                                ).toLocaleDateString()}
                                            </TableCell>
                                            <TableCell className="px-4 py-3 text-right">
                                                <div className="flex justify-end gap-2">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() =>
                                                            openEditDialog(user)
                                                        }
                                                        className="h-8 w-8 p-0 hover:bg-muted"
                                                    >
                                                        <Pencil className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() =>
                                                            handleDelete(
                                                                user.id,
                                                            )
                                                        }
                                                        className="h-8 w-8 p-0 text-red-500 hover:bg-muted hover:text-red-600"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>

            <Dialog open={isCreateDialogOpen} onOpenChange={handleCreateDialogOpenChange}>
                <DialogContent className="max-h-[90vh] overflow-hidden flex flex-col sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>
                            {t('userManagement.createNewUser')}
                        </DialogTitle>
                        <DialogDescription>
                            {t('userManagement.addNewUser')}
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleCreateSubmit} className="flex flex-col flex-1 overflow-hidden">
                        <div className="space-y-4 overflow-y-auto px-1" style={{ maxHeight: 'calc(90vh - 220px)' }}>
                            <div>
                                <Label htmlFor="create-name">
                                    {t('userManagement.name')}
                                </Label>
                                <Input
                                    id="create-name"
                                    type="text"
                                    value={form.name}
                                    onChange={(e) =>
                                        setForm({ ...form, name: e.target.value })
                                    }
                                    required
                                />
                                {createErrors.name && (
                                    <p className="mt-1 text-sm text-destructive">
                                        {createErrors.name}
                                    </p>
                                )}
                            </div>
                            <div>
                                <Label htmlFor="create-email">
                                    {t('userManagement.email')}
                                </Label>
                                <Input
                                    id="create-email"
                                    type="email"
                                    value={form.email}
                                    onChange={(e) =>
                                        setForm({ ...form, email: e.target.value })
                                    }
                                    required
                                />
                                {createErrors.email && (
                                    <p className="mt-1 text-sm text-destructive">
                                        {createErrors.email}
                                    </p>
                                )}
                            </div>
                            <div>
                                <Label htmlFor="create-password">
                                    {t('userManagement.password')}
                                </Label>
                                <Input
                                    id="create-password"
                                    type="password"
                                    value={form.password}
                                    onChange={(e) =>
                                        setForm({
                                            ...form,
                                            password: e.target.value,
                                        })
                                    }
                                    required
                                />
                                {createErrors.password && (
                                    <p className="mt-1 text-sm text-destructive">
                                        {createErrors.password}
                                    </p>
                                )}
                            </div>
                            <div className="flex items-center justify-between">
                                <Label htmlFor="create-role" className="text-right">
                                    {t('userManagement.role')}
                                </Label>
                                <div className="w-3/5">
                                    <Select
                                        value={form.role}
                                        onValueChange={(value) =>
                                            setForm({
                                                ...form,
                                                role: value as UserRole,
                                            })
                                        }
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder={t('userManagement.role')} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {ROLES.map((role) => (
                                                <SelectItem key={role.value} value={role.value}>
                                                    {t(role.label)}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <div className="flex items-center space-x-2">
                                <Checkbox
                                    id="create-is_active"
                                    checked={form.is_active}
                                    onCheckedChange={(checked) =>
                                        setForm({
                                            ...form,
                                            is_active: checked as boolean,
                                        })
                                    }
                                />
                                <Label htmlFor="create-is_active">
                                    {t('userManagement.active')}
                                </Label>
                            </div>
                        </div>
                        <DialogFooter className="flex justify-end gap-2 mt-4">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={closeCreateDialog}
                                disabled={isCreateSubmitting}
                            >
                                {t('userManagement.cancel')}
                            </Button>
                            <Button type="submit" disabled={isCreateSubmitting}>
                                {isCreateSubmitting ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        {t('common.saving')}
                                    </>
                                ) : (
                                    t('userManagement.createUser')
                                )}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog open={isEditDialogOpen} onOpenChange={handleEditDialogOpenChange}>
                <DialogContent className="max-h-[90vh] overflow-hidden flex flex-col sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>
                            {t('userManagement.editUser')}
                        </DialogTitle>
                        <DialogDescription>
                            {t('userManagement.updateUserInfo')}
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleEditSubmit} className="flex flex-col flex-1 overflow-hidden">
                        <div className="space-y-4 overflow-y-auto px-1" style={{ maxHeight: 'calc(90vh - 220px)' }}>
                            <div>
                                <Label htmlFor="edit-name">
                                    {t('userManagement.name')}
                                </Label>
                                <Input
                                    id="edit-name"
                                    type="text"
                                    value={form.name}
                                    onChange={(e) =>
                                        setForm({ ...form, name: e.target.value })
                                    }
                                    required
                                />
                                {editErrors.name && (
                                    <p className="mt-1 text-sm text-destructive">
                                        {editErrors.name}
                                    </p>
                                )}
                            </div>
                            <div>
                                <Label htmlFor="edit-email">
                                    {t('userManagement.email')}
                                </Label>
                                <Input
                                    id="edit-email"
                                    type="email"
                                    value={form.email}
                                    onChange={(e) =>
                                        setForm({ ...form, email: e.target.value })
                                    }
                                    required
                                />
                                {editErrors.email && (
                                    <p className="mt-1 text-sm text-destructive">
                                        {editErrors.email}
                                    </p>
                                )}
                            </div>
                            <div>
                                <Label htmlFor="edit-password">
                                    {t('userManagement.newPassword')}
                                </Label>
                                <Input
                                    id="edit-password"
                                    type="password"
                                    value={form.password}
                                    onChange={(e) =>
                                        setForm({
                                            ...form,
                                            password: e.target.value,
                                        })
                                    }
                                    placeholder={t(
                                        'userManagement.passwordPlaceholder',
                                    )}
                                />
                                {editErrors.password && (
                                    <p className="mt-1 text-sm text-destructive">
                                        {editErrors.password}
                                    </p>
                                )}
                            </div>
                            <div className="flex items-center justify-between">
                                <Label htmlFor="edit-role" className="text-right">
                                    {t('userManagement.role')}
                                </Label>
                                <div className="w-3/5">
                                    <Select
                                        disabled={editingUser?.id === currentUserId}
                                        value={form.role}
                                        onValueChange={(value) =>
                                            setForm({
                                                ...form,
                                                role: value as UserRole,
                                            })
                                        }
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder={t('userManagement.role')} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {ROLES.map((role) => (
                                                <SelectItem key={role.value} value={role.value}>
                                                    {t(role.label)}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <div className="flex items-center space-x-2">
                                <Checkbox
                                    id="edit-is_active"
                                    checked={!!form.is_active}
                                    disabled={editingUser?.id === currentUserId}
                                    onCheckedChange={(checked) =>
                                        setForm({
                                            ...form,
                                            is_active: checked as boolean,
                                        })
                                    }
                                    className="disabled:opacity-50 disabled:cursor-not-allowed"
                                />
                                <Label htmlFor="edit-is_active" className={editingUser?.id === currentUserId ? "text-muted-foreground" : ""}>
                                    {t('userManagement.active')}
                                    {editingUser?.id === currentUserId && (
                                        <span className="ml-2 text-xs text-muted-foreground">
                                            ({t('userManagement.cannotChangeOwnStatus')})
                                        </span>
                                    )}
                                </Label>
                            </div>
                        </div>
                        <DialogFooter className="flex justify-end gap-2 mt-4">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={closeEditDialog}
                                disabled={isEditSubmitting}
                            >
                                {t('userManagement.cancel')}
                            </Button>
                            <Button type="submit" disabled={isEditSubmitting}>
                                {isEditSubmitting ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        {t('common.saving')}
                                    </>
                                ) : (
                                    t('userManagement.updateUser')
                                )}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>
                            {t('userManagement.confirmDelete')}
                        </DialogTitle>
                        <DialogDescription>
                            {t('userManagement.deleteWarning')}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex justify-end gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={cancelDelete}
                        >
                            {t('userManagement.cancel')}
                        </Button>
                        <Button
                            type="button"
                            variant="destructive"
                            onClick={confirmDelete}
                        >
                            {t('userManagement.delete')}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
