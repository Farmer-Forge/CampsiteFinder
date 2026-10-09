import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { AdminComponent } from './admin.component';
import { AdminUsersService } from '../../core/services/admin-users.service';
import { AdminStatsService, AdminStats } from '../../core/services/admin-stats.service';
import { CampgroundAttributesService } from '../../core/services/campground-attributes.service';
import { CampgroundsService } from '../../core/services/campgrounds.service';
import { AdminUser } from '../../core/models/admin-user.model';
import { CampgroundAttribute } from '../../core/models/campground-attribute.model';
import { signal } from '@angular/core';

describe('AdminComponent', () => {
  function setup(
    overrides: { users?: AdminUser[]; attributes?: CampgroundAttribute[]; stats?: AdminStats | null } = {},
  ) {
    const loadUsersSpy = vi.fn().mockResolvedValue(undefined);
    const updateRoleSpy = vi.fn().mockResolvedValue(undefined);
    const setSuspendedSpy = vi.fn().mockResolvedValue(undefined);
    const deleteUserSpy = vi.fn().mockResolvedValue(undefined);
    const inviteUserSpy = vi.fn().mockResolvedValue(undefined);
    const updateDisplayNameSpy = vi.fn().mockResolvedValue(undefined);
    const updateEmailSpy = vi.fn().mockResolvedValue(undefined);
    const usersSignal = signal<AdminUser[]>(overrides.users ?? []);
    const loadForCampgroundSpy = vi.fn().mockResolvedValue(undefined);
    const addAttributeSpy = vi.fn().mockResolvedValue(undefined);
    const updateAttributeSpy = vi.fn().mockResolvedValue(undefined);
    const deleteAttributeSpy = vi.fn().mockResolvedValue(undefined);
    const searchByNameSpy = vi.fn().mockResolvedValue([{ id: 'cg-1', name: 'Blackwoods Campground' }]);
    const loadStatsSpy = vi.fn().mockResolvedValue(undefined);
    const statsSignal = signal<AdminStats | null>(overrides.stats ?? null);

    TestBed.configureTestingModule({
      imports: [AdminComponent],
      providers: [
        {
          provide: AdminUsersService,
          useValue: {
            users: usersSignal,
            loadUsers: loadUsersSpy,
            updateRole: updateRoleSpy,
            setSuspended: setSuspendedSpy,
            deleteUser: deleteUserSpy,
            inviteUser: inviteUserSpy,
            updateDisplayName: updateDisplayNameSpy,
            updateEmail: updateEmailSpy,
          },
        },
        {
          provide: AdminStatsService,
          useValue: { stats: statsSignal, loadStats: loadStatsSpy },
        },
        {
          provide: CampgroundAttributesService,
          useValue: {
            attributes: signal(overrides.attributes ?? []),
            loadForCampground: loadForCampgroundSpy,
            addAttribute: addAttributeSpy,
            updateAttribute: updateAttributeSpy,
            deleteAttribute: deleteAttributeSpy,
          },
        },
        { provide: CampgroundsService, useValue: { searchByName: searchByNameSpy } },
      ],
    });

    const fixture = TestBed.createComponent(AdminComponent);
    return {
      component: fixture.componentInstance,
      loadUsersSpy,
      updateRoleSpy,
      setSuspendedSpy,
      deleteUserSpy,
      inviteUserSpy,
      updateDisplayNameSpy,
      updateEmailSpy,
      loadForCampgroundSpy,
      addAttributeSpy,
      updateAttributeSpy,
      deleteAttributeSpy,
      searchByNameSpy,
      loadStatsSpy,
    };
  }

  const user: AdminUser = {
    id: 'user-1', email: 'alex@example.com', displayName: 'Alex', role: 'user', suspended: false, createdAt: '2026-08-01T00:00:00Z',
  };

  it('loads users on init', async () => {
    const { component, loadUsersSpy } = setup();

    await component.ngOnInit();

    expect(loadUsersSpy).toHaveBeenCalled();
  });

  it('shows an error if loading users fails', async () => {
    const { component, loadUsersSpy } = setup();
    loadUsersSpy.mockRejectedValue(new Error('boom'));

    await component.ngOnInit();

    expect(component.usersError()).toBe('boom');
  });

  it('loads site stats on init', async () => {
    const { component, loadStatsSpy } = setup({ stats: { favoritesCount: 42, tripsCount: 7 } });

    await component.ngOnInit();

    expect(loadStatsSpy).toHaveBeenCalled();
    expect(component.stats()).toEqual({ favoritesCount: 42, tripsCount: 7 });
  });

  it('shows an error if loading stats fails, without blocking the users list', async () => {
    const { component, loadStatsSpy } = setup({ users: [user] });
    loadStatsSpy.mockRejectedValue(new Error('not authorized'));

    await component.ngOnInit();

    expect(component.statsError()).toBe('not authorized');
    expect(component.users()).toEqual([user]);
  });

  it('changes a role', async () => {
    const { component, updateRoleSpy } = setup({ users: [user] });

    await component.onRoleChange('user-1', 'moderator');

    expect(updateRoleSpy).toHaveBeenCalledWith('user-1', 'moderator');
    expect(component.usersError()).toBeNull();
  });

  it('shows an error if a role change fails', async () => {
    const { component, updateRoleSpy } = setup({ users: [user] });
    updateRoleSpy.mockRejectedValue(new Error('cannot modify your own role'));

    await component.onRoleChange('user-1', 'admin');

    expect(component.usersError()).toBe('cannot modify your own role');
  });

  it('reloads users from the server when a role change fails, so the dropdown reflects true state', async () => {
    const { component, updateRoleSpy, loadUsersSpy } = setup({ users: [user] });
    updateRoleSpy.mockRejectedValue(new Error('cannot modify your own role'));

    await component.onRoleChange('user-1', 'admin');

    expect(loadUsersSpy).toHaveBeenCalled();
  });

  it('toggles suspension', async () => {
    const { component, setSuspendedSpy } = setup({ users: [user] });

    await component.onToggleSuspended(user);

    expect(setSuspendedSpy).toHaveBeenCalledWith('user-1', true);
  });

  it('requires confirmation before deleting a user', async () => {
    const { component, deleteUserSpy } = setup({ users: [user] });

    component.onDeleteUser('user-1');
    expect(component.confirmingDeleteUserId()).toBe('user-1');
    expect(deleteUserSpy).not.toHaveBeenCalled();

    await component.onConfirmDeleteUser('user-1');
    expect(deleteUserSpy).toHaveBeenCalledWith('user-1');
    expect(component.confirmingDeleteUserId()).toBeNull();
  });

  it('shows an error and stays confirmable when delete fails', async () => {
    const { component, deleteUserSpy } = setup({ users: [user] });
    deleteUserSpy.mockRejectedValue(new Error('boom'));
    component.onDeleteUser('user-1');

    await component.onConfirmDeleteUser('user-1');

    expect(component.usersError()).toBe('boom');
    expect(component.confirmingDeleteUserId()).toBe('user-1');
  });

  it('cancels a pending delete confirmation', () => {
    const { component } = setup({ users: [user] });
    component.onDeleteUser('user-1');

    component.onCancelDeleteUser();

    expect(component.confirmingDeleteUserId()).toBeNull();
  });

  it('invites a new user and clears the form', async () => {
    const { component, inviteUserSpy } = setup();
    component.newUserEmail = ' new@example.com ';
    component.newUserDisplayName = ' New Person ';

    await component.onInviteUser();

    expect(inviteUserSpy).toHaveBeenCalledWith('new@example.com', 'New Person');
    expect(component.newUserEmail).toBe('');
    expect(component.newUserDisplayName).toBe('');
    expect(component.usersError()).toBeNull();
  });

  it('invites a new user without a display name', async () => {
    const { component, inviteUserSpy } = setup();
    component.newUserEmail = 'new@example.com';

    await component.onInviteUser();

    expect(inviteUserSpy).toHaveBeenCalledWith('new@example.com', undefined);
  });

  it('does not invite a user with a blank email', async () => {
    const { component, inviteUserSpy } = setup();
    component.newUserEmail = '   ';

    await component.onInviteUser();

    expect(inviteUserSpy).not.toHaveBeenCalled();
  });

  it('shows an error if inviting a user fails', async () => {
    const { component, inviteUserSpy } = setup();
    inviteUserSpy.mockRejectedValue(new Error('Email already registered'));
    component.newUserEmail = 'new@example.com';

    await component.onInviteUser();

    expect(component.usersError()).toBe('Email already registered');
  });

  it('starts a user edit seeded from the current row', () => {
    const { component } = setup({ users: [user] });

    component.onStartEditUser(user);

    expect(component.editingUserId()).toBe('user-1');
    expect(component.editDisplayName).toBe('Alex');
    expect(component.editEmail).toBe('alex@example.com');
  });

  it('cancels a user edit', () => {
    const { component } = setup({ users: [user] });
    component.onStartEditUser(user);

    component.onCancelEditUser();

    expect(component.editingUserId()).toBeNull();
  });

  it('saves only the display name when only it changed', async () => {
    const { component, updateDisplayNameSpy, updateEmailSpy } = setup({ users: [user] });
    component.onStartEditUser(user);
    component.editDisplayName = 'Alexandra';

    await component.onSaveEditUser(user);

    expect(updateDisplayNameSpy).toHaveBeenCalledWith('user-1', 'Alexandra');
    expect(updateEmailSpy).not.toHaveBeenCalled();
    expect(component.editingUserId()).toBeNull();
  });

  it('saves only the email when only it changed', async () => {
    const { component, updateDisplayNameSpy, updateEmailSpy } = setup({ users: [user] });
    component.onStartEditUser(user);
    component.editEmail = 'alexandra@example.com';

    await component.onSaveEditUser(user);

    expect(updateEmailSpy).toHaveBeenCalledWith('user-1', 'alexandra@example.com');
    expect(updateDisplayNameSpy).not.toHaveBeenCalled();
  });

  it('saves both fields when both changed', async () => {
    const { component, updateDisplayNameSpy, updateEmailSpy } = setup({ users: [user] });
    component.onStartEditUser(user);
    component.editDisplayName = 'Alexandra';
    component.editEmail = 'alexandra@example.com';

    await component.onSaveEditUser(user);

    expect(updateDisplayNameSpy).toHaveBeenCalledWith('user-1', 'Alexandra');
    expect(updateEmailSpy).toHaveBeenCalledWith('user-1', 'alexandra@example.com');
  });

  it('saves neither field when nothing changed', async () => {
    const { component, updateDisplayNameSpy, updateEmailSpy } = setup({ users: [user] });
    component.onStartEditUser(user);

    await component.onSaveEditUser(user);

    expect(updateDisplayNameSpy).not.toHaveBeenCalled();
    expect(updateEmailSpy).not.toHaveBeenCalled();
    expect(component.editingUserId()).toBeNull();
  });

  it('shows an error and stays in edit mode when saving a user edit fails', async () => {
    const { component, updateDisplayNameSpy } = setup({ users: [user] });
    updateDisplayNameSpy.mockRejectedValue(new Error('boom'));
    component.onStartEditUser(user);
    component.editDisplayName = 'Alexandra';

    await component.onSaveEditUser(user);

    expect(component.usersError()).toBe('boom');
    expect(component.editingUserId()).toBe('user-1');
  });

  const attribute: CampgroundAttribute = {
    id: 'attr-1', campgroundId: 'cg-1', type: 'accessibility', name: 'Wheelchair accessible', value: 'yes', createdAt: '2026-08-01T00:00:00Z',
  };

  it('searches campgrounds by name', async () => {
    const { component, searchByNameSpy } = setup();

    await component.onSearchCampgrounds({ originalEvent: new Event('input'), query: 'black' } as any);

    expect(searchByNameSpy).toHaveBeenCalledWith('black');
    expect(component.campgroundSuggestions()).toEqual([{ id: 'cg-1', name: 'Blackwoods Campground' }]);
  });

  it('shows an error if searching campgrounds fails', async () => {
    const { component, searchByNameSpy } = setup();
    searchByNameSpy.mockRejectedValue(new Error('boom'));

    await component.onSearchCampgrounds({ originalEvent: new Event('input'), query: 'black' } as any);

    expect(component.attributesError()).toBe('boom');
  });

  it('loads attributes when a campground is selected', async () => {
    const { component, loadForCampgroundSpy } = setup();

    await component.onSelectCampground({ originalEvent: new Event('click'), value: { id: 'cg-1', name: 'Blackwoods Campground' } } as any);

    expect(component.selectedCampground).toEqual({ id: 'cg-1', name: 'Blackwoods Campground' });
    expect(loadForCampgroundSpy).toHaveBeenCalledWith('cg-1');
  });

  it('adds an attribute for the selected campground and clears the form', async () => {
    const { component, addAttributeSpy } = setup();
    component.selectedCampground = { id: 'cg-1', name: 'Blackwoods Campground' };
    component.newAttributeType = 'fee';
    component.newAttributeName = 'Reservation fee';
    component.newAttributeValue = '10';

    await component.onAddAttribute();

    expect(addAttributeSpy).toHaveBeenCalledWith('cg-1', 'fee', 'Reservation fee', '10');
    expect(component.newAttributeType).toBe('');
    expect(component.newAttributeName).toBe('');
    expect(component.newAttributeValue).toBe('');
  });

  it('does not add an attribute when no campground is selected', async () => {
    const { component, addAttributeSpy } = setup();
    component.newAttributeType = 'fee';
    component.newAttributeName = 'Reservation fee';

    await component.onAddAttribute();

    expect(addAttributeSpy).not.toHaveBeenCalled();
  });

  it('starts and saves an attribute edit', async () => {
    const { component, updateAttributeSpy } = setup({ attributes: [attribute] });

    component.onStartEditAttribute(attribute);
    expect(component.editingAttributeId()).toBe('attr-1');
    expect(component.editAttributeType).toBe('accessibility');

    component.editAttributeValue = 'no';
    await component.onSaveEditAttribute('attr-1');

    expect(updateAttributeSpy).toHaveBeenCalledWith('attr-1', 'accessibility', 'Wheelchair accessible', 'no');
    expect(component.editingAttributeId()).toBeNull();
  });

  it('cancels an attribute edit', () => {
    const { component } = setup({ attributes: [attribute] });
    component.onStartEditAttribute(attribute);

    component.onCancelEditAttribute();

    expect(component.editingAttributeId()).toBeNull();
  });

  it('deletes an attribute', async () => {
    const { component, deleteAttributeSpy } = setup({ attributes: [attribute] });

    await component.onDeleteAttribute('attr-1');

    expect(deleteAttributeSpy).toHaveBeenCalledWith('attr-1');
  });

  it('shows an error if adding an attribute fails', async () => {
    const { component, addAttributeSpy } = setup();
    addAttributeSpy.mockRejectedValue(new Error('boom'));
    component.selectedCampground = { id: 'cg-1', name: 'Blackwoods Campground' };
    component.newAttributeType = 'fee';
    component.newAttributeName = 'Reservation fee';

    await component.onAddAttribute();

    expect(component.attributesError()).toBe('boom');
  });
});
