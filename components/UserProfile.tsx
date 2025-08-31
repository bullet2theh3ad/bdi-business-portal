'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { User, Edit3, Upload, Save, X, Check } from 'lucide-react';
import type { User as UserType } from '@/lib/db/schema';

// Default avatars available for selection
const DEFAULT_AVATARS = [
  '/avatars/default-1.svg',
  '/avatars/default-2.svg', 
  '/avatars/default-3.svg',
  '/avatars/default-4.svg',
  '/avatars/default-5.svg',
  '/avatars/default-6.svg',
];

interface UserProfileProps {
  user: UserType;
  isEditing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: (formData: FormData) => void;
  isOwner?: boolean;
  isSaving?: boolean;
}

export function UserProfile({ 
  user, 
  isEditing, 
  onEdit, 
  onCancel, 
  onSave,
  isOwner = false,
  isSaving = false 
}: UserProfileProps) {
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [selectedAvatar, setSelectedAvatar] = useState<string>(user.avatarUrl || '');
  const [uploadError, setUploadError] = useState<string>('');

  // Update selectedAvatar when user prop changes (after save)
  useEffect(() => {
    setSelectedAvatar(user.avatarUrl || '');
    setAvatarPreview(null); // Clear any preview
  }, [user.avatarUrl]);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      setUploadError('File size must be less than 2MB');
      return;
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setUploadError('Please select an image file');
      return;
    }

    setUploadError('');
    const reader = new FileReader();
    reader.onload = (e) => {
      const preview = e.target?.result as string;
      setAvatarPreview(preview);
      setSelectedAvatar(preview);
    };
    reader.readAsDataURL(file);
  };

  const handleDefaultAvatarSelect = (avatarUrl: string) => {
    setSelectedAvatar(avatarUrl);
    setAvatarPreview(null);
    setUploadError('');
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    // Create FormData from the form
    const formData = new FormData(e.currentTarget);
    
    // Add selected avatar info
    if (selectedAvatar && DEFAULT_AVATARS.includes(selectedAvatar)) {
      formData.append('defaultAvatar', selectedAvatar);
    }
    
    // Call onSave with formData
    onSave(formData);
  };

  const getUserDisplayName = () => {
    return user.name || user.email || 'Unknown User';
  };

  const getInitials = () => {
    return getUserDisplayName()
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase();
  };

  if (!isEditing) {
    return (
      <Card className="w-full max-w-2xl">
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center space-x-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={user.avatarUrl || ''} alt={getUserDisplayName()} />
              <AvatarFallback className="text-lg">{getInitials()}</AvatarFallback>
            </Avatar>
            <div>
              <CardTitle className="text-xl">{getUserDisplayName()}</CardTitle>
              <p className="text-sm text-muted-foreground capitalize">{user.role}</p>
              {(user as any).teamDisplayName && (
                <p className="text-sm text-blue-600">{(user as any).teamDisplayName}</p>
              )}
            </div>
          </div>
          <Button onClick={onEdit} variant="outline" size="sm">
            <Edit3 className="h-4 w-4 mr-1" />
            Edit Profile
          </Button>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Basic Information */}
          <div>
            <h4 className="font-medium text-sm text-gray-700 mb-2">Contact Information</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Email:</span>
                <p className="font-medium">{user.email}</p>
              </div>
              {user.phone && (
                <div>
                  <span className="text-gray-500">Phone:</span>
                  <p className="font-medium">{user.phone}</p>
                </div>
              )}
              {(user as any).riderId && (
                <div>
                  <span className="text-gray-500">Rider ID:</span>
                  <p className="font-medium font-mono text-xs">{(user as any).riderId}</p>
                </div>
              )}
            </div>
          </div>

          {/* Emergency Contact */}
          {((user as any).emergencyContactName || (user as any).emergencyContactEmail || (user as any).emergencyContactPhone) && (
            <div>
              <h4 className="font-medium text-sm text-gray-700 mb-2">Emergency Contact</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                {(user as any).emergencyContactName && (
                  <div>
                    <span className="text-gray-500">Name:</span>
                    <p className="font-medium">{(user as any).emergencyContactName}</p>
                  </div>
                )}
                {(user as any).emergencyContactEmail && (
                  <div>
                    <span className="text-gray-500">Email:</span>
                    <p className="font-medium">{(user as any).emergencyContactEmail}</p>
                  </div>
                )}
                {(user as any).emergencyContactPhone && (
                  <div className="col-span-full">
                    <span className="text-gray-500">Phone:</span>
                    <p className="font-medium">{(user as any).emergencyContactPhone}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Allergies */}
          {(user as any).allergies && (
            <div>
              <h4 className="font-medium text-sm text-gray-700 mb-2">Allergies & Medical Notes</h4>
              <p className="text-sm bg-red-50 border border-red-200 rounded-lg p-3 text-red-800">
                {(user as any).allergies}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Edit Profile</span>
          <div className="flex space-x-2">
            <Button onClick={onCancel} variant="outline" size="sm">
              <X className="h-4 w-4 mr-1" />
              Cancel
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Avatar Selection */}
          <div className="space-y-4">
            <h4 className="font-medium text-gray-700">Profile Avatar</h4>
            
            {/* Current Avatar Preview */}
            <div className="flex items-center space-x-4">
              <Avatar className="h-20 w-20">
                <AvatarImage 
                  src={avatarPreview || selectedAvatar || user.avatarUrl || ''} 
                  alt={getUserDisplayName()} 
                />
                <AvatarFallback className="text-xl">{getInitials()}</AvatarFallback>
              </Avatar>
              <div className="text-sm text-gray-600">
                <p>Current avatar</p>
                <p className="text-xs">Choose from defaults or upload custom</p>
              </div>
            </div>

            {/* Default Avatar Selection */}
            <div className="space-y-2">
              <Label>Choose Default Avatar</Label>
              <div className="grid grid-cols-6 gap-2">
                {DEFAULT_AVATARS.map((avatarUrl, index) => (
                  <button
                    key={avatarUrl}
                    type="button"
                    onClick={() => handleDefaultAvatarSelect(avatarUrl)}
                    className={`relative p-1 rounded-lg border-2 transition-colors ${
                      selectedAvatar === avatarUrl 
                        ? 'border-blue-500 bg-blue-50' 
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={avatarUrl} alt={`Default avatar ${index + 1}`} />
                    </Avatar>
                    {selectedAvatar === avatarUrl && (
                      <Check className="absolute -top-1 -right-1 h-4 w-4 bg-blue-500 text-white rounded-full p-0.5" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* OR Custom Upload */}
            <div className="space-y-2">
              <Label htmlFor="avatar" className="cursor-pointer">
                <div className="flex items-center space-x-2 text-sm text-blue-600 hover:text-blue-700">
                  <Upload className="h-4 w-4" />
                  <span>Or Upload Custom Avatar</span>
                </div>
              </Label>
              <Input
                id="avatar"
                name="avatar"
                type="file"
                accept="image/*"
                className="cursor-pointer"
                onChange={handleAvatarChange}
              />
              <p className="text-xs text-gray-500">Maximum file size: 2MB • JPG, PNG, GIF, SVG</p>
              {uploadError && (
                <p className="text-xs text-red-600">{uploadError}</p>
              )}
            </div>
          </div>

          {/* Basic Information */}
          <div className="space-y-4">
            <h4 className="font-medium text-gray-700">Basic Information</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  name="name"
                  defaultValue={user.name || ''}
                  placeholder="Enter full name"
                />
              </div>
              <div>
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  defaultValue={user.phone || ''}
                  placeholder="+1 (555) 123-4567"
                />
              </div>
              {isOwner && (
                <div className="md:col-span-2">
                  <Label htmlFor="teamDisplayName">Team Display Name</Label>
                  <Input
                    id="teamDisplayName"
                    name="teamDisplayName"
                    defaultValue={(user as any).teamDisplayName || ''}
                    placeholder="e.g., Lead Rider, Safety Officer, etc."
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Optional role or title for team display
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Emergency Contact */}
          <div className="space-y-4">
            <h4 className="font-medium text-gray-700">Emergency Contact</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="emergencyContactName">Contact Name</Label>
                <Input
                  id="emergencyContactName"
                  name="emergencyContactName"
                  defaultValue={(user as any).emergencyContactName || ''}
                  placeholder="Emergency contact name"
                />
              </div>
              <div>
                <Label htmlFor="emergencyContactPhone">Contact Phone</Label>
                <Input
                  id="emergencyContactPhone"
                  name="emergencyContactPhone"
                  type="tel"
                  defaultValue={(user as any).emergencyContactPhone || ''}
                  placeholder="+1 (555) 987-6543"
                />
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="emergencyContactEmail">Contact Email</Label>
                <Input
                  id="emergencyContactEmail"
                  name="emergencyContactEmail"
                  type="email"
                  defaultValue={(user as any).emergencyContactEmail || ''}
                  placeholder="emergency@contact.com"
                />
              </div>
            </div>
          </div>

          {/* Medical Information */}
          <div className="space-y-4">
            <h4 className="font-medium text-gray-700">Medical Information</h4>
            <div>
              <Label htmlFor="allergies">Allergies & Medical Notes</Label>
              <textarea
                id="allergies"
                name="allergies"
                rows={3}
                defaultValue={(user as any).allergies || ''}
                placeholder="List any allergies, medical conditions, or important medical information..."
                className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                This information may be shared with emergency responders if needed
              </p>
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t">
            <Button type="button" onClick={onCancel} variant="outline">
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
              <Save className="h-4 w-4 mr-1" />
              {isSaving ? 'Saving...' : 'Save Profile'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}