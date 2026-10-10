import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SelectModule } from 'primeng/select';
import { AutoCompleteModule, AutoCompleteCompleteEvent, AutoCompleteSelectEvent } from 'primeng/autocomplete';
import { AdminUsersService } from '../../core/services/admin-users.service';
import { AdminStatsService } from '../../core/services/admin-stats.service';
import { CampgroundAttributesService } from '../../core/services/campground-attributes.service';
import { CampgroundsService } from '../../core/services/campgrounds.service';
import { AdminUser } from '../../core/models/admin-user.model';
import { CampgroundAttribute } from '../../core/models/campground-attribute.model';

const ROLE_OPTIONS: { label: string; value: 'user' | 'moderator' | 'admin' }[] = [
  { label: 'User', value: 'user' },
  { label: 'Moderator', value: 'moderator' },
  { label: 'Admin', value: 'admin' },
];

interface CampgroundOption {
  id: string;
  name: string;
}

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [DatePipe, FormsModule, SelectModule, AutoCompleteModule],
  templateUrl: './admin.component.html',
  styles: `
    .admin {
      max-width: 1200px;
    }
    .admin-stats {
      display: flex;
      gap: 20px;
      flex-wrap: wrap;
    }
    .admin-stat {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 14px 22px 14px 14px;
      border: 3px solid var(--rt-ink);
      border-radius: 999px;
      background: var(--rt-card);
      box-shadow: 4px 4px 0 var(--rt-ink);
    }
    .admin-stat-value {
      width: 64px;
      height: 64px;
      box-sizing: border-box;
      border-radius: 50%;
      border: 2px solid var(--rt-ink);
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: var(--rt-display);
      font-size: 22px;
    }
    .admin-stat-value.favorites {
      background: var(--rt-mustard);
    }
    .admin-stat-value.trips {
      background: var(--rt-teal);
      color: var(--rt-cream);
    }
    .admin-stat-label {
      font-weight: 700;
      font-size: 15px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    .tabs {
      display: flex;
      gap: 6px;
      border-bottom: 3px solid var(--rt-ink);
      margin-bottom: -8px;
    }
    .tab {
      font: inherit;
      font-weight: 700;
      font-size: 15px;
      padding: 10px 20px;
      border: 3px solid var(--rt-ink);
      border-bottom: none;
      border-radius: 12px 12px 0 0;
      margin-bottom: -3px;
      cursor: pointer;
      background: var(--rt-sand);
      color: var(--rt-ink);
    }
    .tab.active {
      background: var(--rt-card);
      padding-bottom: 13px;
    }
    .tab-panel {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .add-user-form {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }
    .add-user-form .rt-input {
      flex: 1;
      min-width: 200px;
    }
    .users-table {
      min-width: 860px;
    }
    .email,
    .attr-name {
      font-weight: 600;
    }
    :host ::ng-deep .role-pill {
      border-radius: 999px !important;
      border-width: 1.5px !important;
    }
    :host ::ng-deep .role-pill .p-select-label {
      font-size: 12px;
      font-weight: 700;
      padding: 3px 0 3px 10px !important;
    }
    :host ::ng-deep .role-pill.role-admin {
      background: var(--rt-mustard) !important;
    }
    :host ::ng-deep .campground-search {
      max-width: 480px;
      width: 100%;
    }
    :host ::ng-deep .campground-search .p-autocomplete-input {
      width: 100%;
    }
  `,
})
export class AdminComponent implements OnInit {
  private readonly adminUsersService = inject(AdminUsersService);
  private readonly adminStatsService = inject(AdminStatsService);

  readonly roleOptions = ROLE_OPTIONS;
  readonly activeTab = signal<'users' | 'attributes'>('users');
  readonly users = this.adminUsersService.users;
  readonly usersError = signal<string | null>(null);
  readonly confirmingDeleteUserId = signal<string | null>(null);
  readonly stats = this.adminStatsService.stats;
  readonly statsError = signal<string | null>(null);

  newUserEmail = '';
  newUserDisplayName = '';

  readonly editingUserId = signal<string | null>(null);
  editDisplayName = '';
  editEmail = '';

  async ngOnInit(): Promise<void> {
    await Promise.all([this.loadUsers(), this.loadStats()]);
  }

  private async loadUsers(): Promise<void> {
    try {
      await this.adminUsersService.loadUsers();
    } catch (err) {
      this.usersError.set(err instanceof Error ? err.message : 'Could not load users.');
    }
  }

  private async loadStats(): Promise<void> {
    try {
      await this.adminStatsService.loadStats();
    } catch (err) {
      this.statsError.set(err instanceof Error ? err.message : 'Could not load site stats.');
    }
  }

  async onRoleChange(userId: string, role: 'user' | 'moderator' | 'admin'): Promise<void> {
    this.usersError.set(null);
    try {
      await this.adminUsersService.updateRole(userId, role);
    } catch (err) {
      this.usersError.set(err instanceof Error ? err.message : 'Could not update role.');
      await this.adminUsersService.loadUsers().catch(() => {});
    }
  }

  async onToggleSuspended(user: AdminUser): Promise<void> {
    this.usersError.set(null);
    try {
      await this.adminUsersService.setSuspended(user.id, !user.suspended);
    } catch (err) {
      this.usersError.set(err instanceof Error ? err.message : 'Could not update suspension.');
    }
  }

  onDeleteUser(userId: string): void {
    this.confirmingDeleteUserId.set(userId);
  }

  onCancelDeleteUser(): void {
    this.confirmingDeleteUserId.set(null);
  }

  async onConfirmDeleteUser(userId: string): Promise<void> {
    this.usersError.set(null);
    try {
      await this.adminUsersService.deleteUser(userId);
      this.confirmingDeleteUserId.set(null);
    } catch (err) {
      this.usersError.set(err instanceof Error ? err.message : 'Could not delete user.');
    }
  }

  async onInviteUser(): Promise<void> {
    const email = this.newUserEmail.trim();
    if (email === '') return;
    this.usersError.set(null);
    try {
      await this.adminUsersService.inviteUser(email, this.newUserDisplayName.trim() || undefined);
      this.newUserEmail = '';
      this.newUserDisplayName = '';
    } catch (err) {
      this.usersError.set(err instanceof Error ? err.message : 'Could not invite user.');
    }
  }

  onStartEditUser(user: AdminUser): void {
    this.editingUserId.set(user.id);
    this.editDisplayName = user.displayName;
    this.editEmail = user.email;
  }

  onCancelEditUser(): void {
    this.editingUserId.set(null);
  }

  async onSaveEditUser(user: AdminUser): Promise<void> {
    this.usersError.set(null);
    try {
      if (this.editDisplayName !== user.displayName) {
        await this.adminUsersService.updateDisplayName(user.id, this.editDisplayName);
      }
      if (this.editEmail !== user.email) {
        await this.adminUsersService.updateEmail(user.id, this.editEmail);
      }
      this.editingUserId.set(null);
    } catch (err) {
      this.usersError.set(err instanceof Error ? err.message : 'Could not update user.');
    }
  }

  private readonly campgroundAttributesService = inject(CampgroundAttributesService);
  private readonly campgroundsService = inject(CampgroundsService);

  readonly campgroundSuggestions = signal<CampgroundOption[]>([]);
  selectedCampground: CampgroundOption | null = null;
  readonly attributes = this.campgroundAttributesService.attributes;
  readonly attributesError = signal<string | null>(null);

  newAttributeType = '';
  newAttributeName = '';
  newAttributeValue = '';

  readonly editingAttributeId = signal<string | null>(null);
  editAttributeType = '';
  editAttributeName = '';
  editAttributeValue = '';

  async onSearchCampgrounds(event: AutoCompleteCompleteEvent): Promise<void> {
    this.attributesError.set(null);
    try {
      const results = await this.campgroundsService.searchByName(event.query);
      this.campgroundSuggestions.set(results);
    } catch (err) {
      this.attributesError.set(err instanceof Error ? err.message : 'Could not search campgrounds.');
    }
  }

  async onSelectCampground(event: AutoCompleteSelectEvent): Promise<void> {
    this.attributesError.set(null);
    const campground = event.value as CampgroundOption;
    this.selectedCampground = campground;
    try {
      await this.campgroundAttributesService.loadForCampground(campground.id);
    } catch (err) {
      this.attributesError.set(err instanceof Error ? err.message : 'Could not load attributes.');
    }
  }

  async onAddAttribute(): Promise<void> {
    if (!this.selectedCampground || this.newAttributeType.trim() === '' || this.newAttributeName.trim() === '') {
      return;
    }
    this.attributesError.set(null);
    try {
      await this.campgroundAttributesService.addAttribute(
        this.selectedCampground.id,
        this.newAttributeType.trim(),
        this.newAttributeName.trim(),
        this.newAttributeValue.trim() === '' ? null : this.newAttributeValue.trim(),
      );
      this.newAttributeType = '';
      this.newAttributeName = '';
      this.newAttributeValue = '';
    } catch (err) {
      this.attributesError.set(err instanceof Error ? err.message : 'Could not add attribute.');
    }
  }

  onStartEditAttribute(attribute: CampgroundAttribute): void {
    this.editingAttributeId.set(attribute.id);
    this.editAttributeType = attribute.type;
    this.editAttributeName = attribute.name;
    this.editAttributeValue = attribute.value ?? '';
  }

  onCancelEditAttribute(): void {
    this.editingAttributeId.set(null);
  }

  async onSaveEditAttribute(attributeId: string): Promise<void> {
    this.attributesError.set(null);
    try {
      await this.campgroundAttributesService.updateAttribute(
        attributeId,
        this.editAttributeType.trim(),
        this.editAttributeName.trim(),
        this.editAttributeValue.trim() === '' ? null : this.editAttributeValue.trim(),
      );
      this.editingAttributeId.set(null);
    } catch (err) {
      this.attributesError.set(err instanceof Error ? err.message : 'Could not update attribute.');
    }
  }

  async onDeleteAttribute(attributeId: string): Promise<void> {
    this.attributesError.set(null);
    try {
      await this.campgroundAttributesService.deleteAttribute(attributeId);
    } catch (err) {
      this.attributesError.set(err instanceof Error ? err.message : 'Could not delete attribute.');
    }
  }
}
