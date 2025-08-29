'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Plus, Edit, Trash2 } from 'lucide-react';
import { createGroupAction, updateGroupAction, deleteGroupAction } from '@/app/(login)/actions';
import { useActionState } from 'react';
import { useState } from 'react';

interface TeamGroup {
  id: number;
  name: string;
  description: string | null;
  color: string | null;
  memberCount: number;
}

const PRESET_COLORS = [
  '#3B82F6', // Blue
  '#10B981', // Green
  '#F59E0B', // Yellow
  '#EF4444', // Red
  '#8B5CF6', // Purple
  '#06B6D4', // Cyan
  '#F97316', // Orange
  '#6B7280', // Gray
  '#EC4899', // Pink
  '#84CC16'  // Lime
];

function ColorPicker({ value, onChange }: { value: string; onChange: (color: string) => void }) {
  return (
    <div className="space-y-2">
      <Label>Color</Label>
      <div className="flex flex-wrap gap-2">
        {PRESET_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            className={`w-8 h-8 rounded-full border-2 ${value === color ? 'border-gray-800' : 'border-gray-300'}`}
            style={{ backgroundColor: color }}
            onClick={() => onChange(color)}
            title={color}
          />
        ))}
      </div>
      <div className="flex items-center gap-2 mt-2">
        <Label htmlFor="custom-color" className="text-sm">Custom:</Label>
        <Input
          id="custom-color"
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-16 h-8 p-1 border rounded"
        />
        <span className="text-sm text-gray-500">{value}</span>
      </div>
    </div>
  );
}

function DeleteGroupForm({ group, onDeleted }: { group: TeamGroup; onDeleted: () => void }) {
  const [state, action, isPending] = useActionState(deleteGroupAction, { error: '' });
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!confirmDelete) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <div className="flex items-start gap-3">
          <Trash2 className="h-5 w-5 text-red-600 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-medium text-red-900 mb-1">Delete Group</h4>
            <p className="text-sm text-red-700 mb-3">
              This will permanently delete the "{group.name}" group and remove all {group.memberCount} members from it. 
              This action cannot be undone.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmDelete(true)}
              className="text-red-600 border-red-300 hover:bg-red-100"
            >
              I understand, delete this group
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
      <div className="flex items-start gap-3">
        <Trash2 className="h-5 w-5 text-red-600 mt-0.5" />
        <div className="flex-1">
          <h4 className="font-medium text-red-900 mb-1">Confirm Deletion</h4>
          <p className="text-sm text-red-700 mb-3">
            Type the group name "<strong>{group.name}</strong>" to confirm deletion:
          </p>
          <form action={action} className="space-y-3">
            <input type="hidden" name="groupId" value={group.id} />
            <Input
              name="confirmName"
              placeholder={group.name}
              required
              className="border-red-300"
              onInput={(e) => {
                const target = e.target as HTMLInputElement;
                const submitBtn = target.closest('form')?.querySelector('button[type="submit"]') as HTMLButtonElement;
                if (submitBtn) {
                  submitBtn.disabled = target.value !== group.name || isPending;
                }
              }}
            />
            <div className="flex items-center gap-2">
              <Button
                type="submit"
                disabled={isPending}
                className="bg-red-600 hover:bg-red-700"
                onClick={() => {
                  setTimeout(() => onDeleted(), 1000);
                }}
              >
                {isPending ? 'Deleting...' : 'Delete Group'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setConfirmDelete(false)}
                disabled={isPending}
              >
                Cancel
              </Button>
            </div>
          </form>
          {state?.error && (
            <p className="text-sm text-red-600 mt-2">{state.error}</p>
          )}
          {'success' in state && state?.success && (
            <p className="text-sm text-green-600 mt-2">{state.success}</p>
          )}
        </div>
      </div>
    </div>
  );
}

export function CreateGroupForm({ onBack, onCreated }: { onBack: () => void; onCreated: () => void }) {
  const [state, action, isPending] = useActionState(createGroupAction, { error: '' });
  const [selectedColor, setSelectedColor] = useState('#3B82F6');

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Plus className="h-5 w-5" />
          Create New Group
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-4">
          <div>
            <Label htmlFor="name">Group Name *</Label>
            <Input
              id="name"
              name="name"
              placeholder="e.g., Sales Team, Field Workers"
              required
              maxLength={100}
            />
          </div>
          
          <div>
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              name="description"
              placeholder="Brief description of this group's purpose"
              maxLength={255}
            />
          </div>

          <ColorPicker value={selectedColor} onChange={setSelectedColor} />
          <input type="hidden" name="color" value={selectedColor} />

          <div className="flex items-center gap-3 pt-4">
            <Button 
              type="submit" 
              disabled={isPending}
              onClick={() => {
                if (state && 'success' in state && state.success) {
                  setTimeout(() => onCreated(), 1000);
                }
              }}
            >
              {isPending ? 'Creating...' : 'Create Group'}
            </Button>
            <Button type="button" variant="outline" onClick={onBack}>
              Cancel
            </Button>
          </div>

          {state?.error && (
            <p className="text-sm text-red-500">{state.error}</p>
          )}
          {'success' in state && state?.success && (
            <p className="text-sm text-green-500">{state.success}</p>
          )}
        </form>
      </CardContent>
    </Card>
  );
}

export function EditGroupForm({ 
  group, 
  onBack, 
  onUpdated 
}: { 
  group: TeamGroup; 
  onBack: () => void; 
  onUpdated: () => void;
}) {
  const [state, action, isPending] = useActionState(updateGroupAction, { error: '' });
  const [selectedColor, setSelectedColor] = useState(group.color || '#3B82F6');

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Edit className="h-5 w-5" />
          Edit Group: {group.name}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <form action={action} className="space-y-4">
          <input type="hidden" name="groupId" value={group.id} />
          
          <div>
            <Label htmlFor="name">Group Name *</Label>
            <Input
              id="name"
              name="name"
              defaultValue={group.name}
              placeholder="e.g., Sales Team, Field Workers"
              required
              maxLength={100}
            />
          </div>
          
          <div>
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              name="description"
              defaultValue={group.description || ''}
              placeholder="Brief description of this group's purpose"
              maxLength={255}
            />
          </div>

          <ColorPicker value={selectedColor} onChange={setSelectedColor} />
          <input type="hidden" name="color" value={selectedColor} />

          <div className="flex items-center gap-3 pt-4">
            <Button 
              type="submit" 
              disabled={isPending}
              onClick={() => {
                if (state && 'success' in state && state.success) {
                  setTimeout(() => onUpdated(), 1000);
                }
              }}
            >
              {isPending ? 'Updating...' : 'Update Group'}
            </Button>
            <Button type="button" variant="outline" onClick={onBack}>
              Cancel
            </Button>
          </div>

          {state?.error && (
            <p className="text-sm text-red-500">{state.error}</p>
          )}
          {'success' in state && state?.success && (
            <p className="text-sm text-green-500">{state.success}</p>
          )}
        </form>

        {/* Delete Group Section */}
        <div className="border-t pt-6">
          <DeleteGroupForm group={group} onDeleted={onUpdated} />
        </div>
      </CardContent>
    </Card>
  );
}
