'use client';

import { useState, useEffect } from 'react';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SemanticBDIIcon } from '@/components/BDIIcon';
import { Separator } from '@/components/ui/separator';
import useSWR from 'swr';
import { User } from '@/lib/db/schema';

// Extended user type that includes organization data
interface UserWithOrganization extends User {
  organization?: {
    id: string;
    name: string;
    legalName?: string;
    code: string;
    type?: string;
    dunsNumber?: string;
    taxId?: string;
    industryCode?: string;
    companySize?: string;
    businessAddress?: string;
    billingAddress?: string;
  } | null;
}
import { updateCompleteProfile, updateUserProfile } from '../actions';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function ProfilePage() {
  const { data: user, mutate } = useSWR<UserWithOrganization>('/api/user', fetcher);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    // Personal Information
    name: '',
    email: '',
    phone: '',
    title: '',
    department: '',
    
    // Business Information
    companyName: '',
    companyLegalName: '',
    dunsNumber: '',
    taxId: '',
    industryCode: '',
    companySize: '',
    
    // Contact Information
    businessAddress: '',
    billingAddress: '',
    primaryContactName: '',
    primaryContactEmail: '',
    primaryContactPhone: '',
    technicalContactName: '',
    technicalContactEmail: '',
    technicalContactPhone: '',
    
    // Supply Chain Preferences
    supplierCode: '',
    preferredCommunication: 'portal',
    standardLeadTime: '',
    expeditedLeadTime: '',
    minimumOrderQty: '',
    paymentTerms: 'NET30',
    
    // Technical Integration
    dataExchangeFormats: ['JSON'],
    frequencyPreference: 'daily',
    businessHours: '9:00 AM - 5:00 PM EST',
    timeZone: 'America/New_York'
  });

  // Initialize form data when user data loads
  React.useEffect(() => {
    if (user) {
      setFormData({
        // Personal Information
        name: user.name || '',
        email: user.email || '',
        phone: user.phone || '',
        title: user.title || '',
        department: user.department || '',
        
        // Business Information (from organization or user)
        companyName: user.organization?.name || '',
        companyLegalName: user.organization?.legalName || '',
        dunsNumber: user.organization?.dunsNumber || '',
        taxId: user.organization?.taxId || '',
        industryCode: user.organization?.industryCode || '',
        companySize: user.organization?.companySize || '',
        
        // Contact Information (personal + organization-level)
        businessAddress: user.organization?.businessAddress || '',
        billingAddress: user.organization?.billingAddress || '',
        primaryContactName: user.primaryContactName || user.organization?.contactEmail?.split('@')[0] || '',
        primaryContactEmail: user.primaryContactEmail || user.organization?.contactEmail || '',
        primaryContactPhone: user.primaryContactPhone || user.organization?.contactPhone || '',
        technicalContactName: user.technicalContactName || user.name || '',
        technicalContactEmail: user.technicalContactEmail || user.email || '',
        technicalContactPhone: user.technicalContactPhone || user.phone || '',
        
        // Supply Chain Preferences
        supplierCode: user.supplierCode || '',
        preferredCommunication: user.preferredCommunication || 'portal',
        standardLeadTime: user.standardLeadTime?.toString() || '',
        expeditedLeadTime: user.expeditedLeadTime?.toString() || '',
        minimumOrderQty: user.minimumOrderQty?.toString() || '',
        paymentTerms: user.paymentTerms || 'NET30',
        
        // Technical Integration
        dataExchangeFormats: Array.isArray(user.dataExchangeFormats) ? user.dataExchangeFormats : ['JSON'],
        frequencyPreference: user.frequencyPreference || 'daily',
        businessHours: user.businessHours || '9:00 AM - 5:00 PM EST',
        timeZone: user.timeZone || 'America/New_York'
      });
    }
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    
    setIsSaving(true);
    try {
      // Prepare user profile data
      const profileData = {
        name: formData.name,
        phone: formData.phone,
        title: formData.title,
        department: formData.department,
        supplierCode: formData.supplierCode,
        preferredCommunication: formData.preferredCommunication as 'portal' | 'api' | 'edi' | 'email',
        standardLeadTime: formData.standardLeadTime ? parseInt(formData.standardLeadTime) : undefined,
        expeditedLeadTime: formData.expeditedLeadTime ? parseInt(formData.expeditedLeadTime) : undefined,
        minimumOrderQty: formData.minimumOrderQty ? parseInt(formData.minimumOrderQty) : undefined,
        paymentTerms: formData.paymentTerms as 'NET15' | 'NET30' | 'NET45' | 'NET60' | 'COD' | 'PREPAID',
        businessHours: formData.businessHours,
        timeZone: formData.timeZone,
        dataExchangeFormats: formData.dataExchangeFormats,
        frequencyPreference: formData.frequencyPreference as 'real-time' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'on-demand',
        primaryContactName: formData.primaryContactName,
        primaryContactEmail: formData.primaryContactEmail,
        primaryContactPhone: formData.primaryContactPhone,
        technicalContactName: formData.technicalContactName,
        technicalContactEmail: formData.technicalContactEmail,
        technicalContactPhone: formData.technicalContactPhone,
      };

      // Prepare organization data
      const organizationData = {
        companyName: formData.companyName,
        companyLegalName: formData.companyLegalName,
        dunsNumber: formData.dunsNumber,
        taxId: formData.taxId,
        industryCode: formData.industryCode,
        companySize: formData.companySize as '1-10' | '11-50' | '51-200' | '201-1000' | '1000+',
        businessAddress: formData.businessAddress,
        billingAddress: formData.billingAddress,
      };

      // Debug logging
      console.log('User object:', user);
      console.log('User organization:', user.organization);
      console.log('Organization data to save:', organizationData);

      // Only admins can update organization data
      if (['super_admin', 'admin'].includes(user.role) && user.organization?.id) {
        // Admin users can update both personal and organization data
        const result = await updateCompleteProfile(
          user.authId, 
          user.organization.id,
          profileData,
          organizationData
        );

        if (result.success) {
          setIsEditing(false);
          mutate(); // Refresh user data
          // TODO: Show success toast
        } else {
          console.error('Save failed:', result.error);
          // TODO: Show error toast
        }
      } else {
        // Members and developers can only update personal profile data
        const userResult = await updateUserProfile(user.authId, profileData);
        
        if (userResult.success) {
          setIsEditing(false);
          mutate(); // Refresh user data
          // TODO: Show success toast
        } else {
          console.error('Save failed:', userResult.error);
          // TODO: Show error toast
        }
      }
    } catch (error) {
      console.error('Failed to save profile:', error);
      // TODO: Show error toast
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    // Reset form data to original values
    if (user) {
      setFormData(prev => ({
        ...prev,
        name: user.name || '',
        email: user.email || '',
        phone: user.phone || '',
        title: user.title || '',
        department: user.department || '',
      }));
    }
    setIsEditing(false);
  };

  if (!user) {
    return (
      <div className="flex-1 p-4 lg:p-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <SemanticBDIIcon semantic="profile" size={48} className="mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">Loading profile...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-4 lg:p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <SemanticBDIIcon semantic="profile" size={32} />
            <div>
              <h1 className="text-3xl font-bold">My Account Profile</h1>
              <p className="text-muted-foreground">Manage your personal and business information for B2B data exchange</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Badge variant={user.role === 'super_admin' ? 'default' : 'secondary'} className="bg-bdi-green-1 text-white">
              {user.role.replace('_', ' ').toUpperCase()}
            </Badge>
            {!isEditing ? (
              <Button onClick={() => setIsEditing(true)} className="bg-bdi-green-1 hover:bg-bdi-green-2">
                <SemanticBDIIcon semantic="settings" size={16} className="mr-2 brightness-0 invert" />
                Edit Profile
              </Button>
            ) : (
              <div className="flex space-x-2">
                <Button variant="outline" onClick={handleCancel} disabled={isSaving}>
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={isSaving} className="bg-bdi-green-1 hover:bg-bdi-green-2">
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Personal Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <SemanticBDIIcon semantic="profile" size={20} className="mr-2" />
              Personal Information
            </CardTitle>
            <CardDescription>Your personal details and contact information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4">
              <div>
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  disabled={!isEditing}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  disabled={!isEditing}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                  disabled={!isEditing}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="title">Job Title</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  disabled={!isEditing}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="department">Department</Label>
                <Input
                  id="department"
                  value={formData.department}
                  onChange={(e) => setFormData(prev => ({ ...prev, department: e.target.value }))}
                  disabled={!isEditing}
                  className="mt-1"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Business Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <SemanticBDIIcon semantic="collaboration" size={20} className="mr-2" />
              Business Information
              {!['super_admin', 'admin'].includes(user.role) && (
                <Badge variant="secondary" className="ml-2 text-xs">
                  View Only
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              Company details for B2B transactions and compliance
              {!['super_admin', 'admin'].includes(user.role) && (
                <span className="block text-xs text-muted-foreground mt-1">
                  Contact your administrator to modify business information
                </span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="companyName">Company Name</Label>
              <Input
                id="companyName"
                value={formData.companyName}
                onChange={(e) => setFormData(prev => ({ ...prev, companyName: e.target.value }))}
                disabled={!isEditing || !['super_admin', 'admin'].includes(user.role)}
                className="mt-1"
                placeholder="Boundless Devices Inc"
              />
            </div>
            <div>
              <Label htmlFor="companyLegalName">Legal Business Name</Label>
              <Input
                id="companyLegalName"
                value={formData.companyLegalName}
                onChange={(e) => setFormData(prev => ({ ...prev, companyLegalName: e.target.value }))}
                disabled={!isEditing || !['super_admin', 'admin'].includes(user.role)}
                className="mt-1"
                placeholder="If different from company name"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="dunsNumber">DUNS Number</Label>
                <Input
                  id="dunsNumber"
                  value={formData.dunsNumber}
                  onChange={(e) => setFormData(prev => ({ ...prev, dunsNumber: e.target.value }))}
                  disabled={!isEditing || !['super_admin', 'admin'].includes(user.role)}
                  className="mt-1"
                  placeholder="123456789"
                />
              </div>
              <div>
                <Label htmlFor="taxId">Tax ID / EIN</Label>
                <Input
                  id="taxId"
                  value={formData.taxId}
                  onChange={(e) => setFormData(prev => ({ ...prev, taxId: e.target.value }))}
                  disabled={!isEditing || !['super_admin', 'admin'].includes(user.role)}
                  className="mt-1"
                  placeholder="12-3456789"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="industryCode">Industry Code (NAICS)</Label>
                <Input
                  id="industryCode"
                  value={formData.industryCode}
                  onChange={(e) => setFormData(prev => ({ ...prev, industryCode: e.target.value }))}
                  disabled={!isEditing || !['super_admin', 'admin'].includes(user.role)}
                  className="mt-1"
                  placeholder="334418"
                />
              </div>
              <div>
                <Label htmlFor="companySize">Company Size</Label>
                <select
                  id="companySize"
                  value={formData.companySize}
                  onChange={(e) => setFormData(prev => ({ ...prev, companySize: e.target.value }))}
                  disabled={!isEditing || !['super_admin', 'admin'].includes(user.role)}
                  className="mt-1 w-full h-9 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bdi-green-1 disabled:bg-gray-100 text-sm"
                >
                  <option value="">Select size</option>
                  <option value="1-10">1-10 employees</option>
                  <option value="11-50">11-50 employees</option>
                  <option value="51-200">51-200 employees</option>
                  <option value="201-1000">201-1000 employees</option>
                  <option value="1000+">1000+ employees</option>
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Contact Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <SemanticBDIIcon semantic="connect" size={20} className="mr-2" />
              Contact Information
              {!['super_admin', 'admin'].includes(user.role) && (
                <Badge variant="secondary" className="ml-2 text-xs">
                  View Only
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              Business addresses and key contacts
              {!['super_admin', 'admin'].includes(user.role) && (
                <span className="block text-xs text-muted-foreground mt-1">
                  Contact information can only be modified by administrators
                </span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="businessAddress">
                Business Address
                {!['super_admin', 'admin'].includes(user.role) && (
                  <Badge variant="secondary" className="ml-2 text-xs">
                    Admin Only
                  </Badge>
                )}
              </Label>
              <textarea
                id="businessAddress"
                value={formData.businessAddress}
                onChange={(e) => setFormData(prev => ({ ...prev, businessAddress: e.target.value }))}
                disabled={!isEditing || !['super_admin', 'admin'].includes(user.role)}
                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bdi-green-1 disabled:bg-gray-100"
                rows={3}
                placeholder="123 Business St, Suite 100&#10;City, State 12345&#10;United States"
              />
              {!['super_admin', 'admin'].includes(user.role) && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Business address can only be modified by administrators
                </p>
              )}
            </div>
            
            <Separator />
            
            <div>
              <Label className="text-sm font-medium text-gray-700">Primary Business Contact</Label>
              <div className="grid grid-cols-1 gap-3 mt-2">
                <Input
                  placeholder="Contact Name"
                  value={formData.primaryContactName}
                  onChange={(e) => setFormData(prev => ({ ...prev, primaryContactName: e.target.value }))}
                  disabled={!isEditing || !['super_admin', 'admin'].includes(user.role)}
                />
                <Input
                  type="email"
                  placeholder="contact@company.com"
                  value={formData.primaryContactEmail}
                  onChange={(e) => setFormData(prev => ({ ...prev, primaryContactEmail: e.target.value }))}
                  disabled={!isEditing || !['super_admin', 'admin'].includes(user.role)}
                />
                <Input
                  placeholder="Phone Number"
                  value={formData.primaryContactPhone}
                  onChange={(e) => setFormData(prev => ({ ...prev, primaryContactPhone: e.target.value }))}
                  disabled={!isEditing || !['super_admin', 'admin'].includes(user.role)}
                />
              </div>
            </div>

            <Separator />

            <div>
              <Label className="text-sm font-medium text-gray-700">Technical Contact (API/EDI)</Label>
              <div className="grid grid-cols-1 gap-3 mt-2">
                <Input
                  placeholder="Technical Contact Name"
                  value={formData.technicalContactName}
                  onChange={(e) => setFormData(prev => ({ ...prev, technicalContactName: e.target.value }))}
                  disabled={!isEditing || !['super_admin', 'admin'].includes(user.role)}
                />
                <Input
                  type="email"
                  placeholder="tech@company.com"
                  value={formData.technicalContactEmail}
                  onChange={(e) => setFormData(prev => ({ ...prev, technicalContactEmail: e.target.value }))}
                  disabled={!isEditing || !['super_admin', 'admin'].includes(user.role)}
                />
                <Input
                  placeholder="Technical Phone Number"
                  value={formData.technicalContactPhone}
                  onChange={(e) => setFormData(prev => ({ ...prev, technicalContactPhone: e.target.value }))}
                  disabled={!isEditing || !['super_admin', 'admin'].includes(user.role)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Supply Chain Preferences */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <SemanticBDIIcon semantic="supply" size={20} className="mr-2" />
              Supply Chain Preferences
              {!['super_admin', 'admin'].includes(user.role) && (
                <Badge variant="secondary" className="ml-2 text-xs">
                  View Only
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              CPFR and supply chain specific settings
              {!['super_admin', 'admin'].includes(user.role) && (
                <span className="block text-xs text-muted-foreground mt-1">
                  Supply chain preferences can only be modified by administrators
                </span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="supplierCode">Supplier/Customer Code</Label>
                <Input
                  id="supplierCode"
                  value={formData.supplierCode}
                  onChange={(e) => setFormData(prev => ({ ...prev, supplierCode: e.target.value }))}
                  disabled={!isEditing || !['super_admin', 'admin'].includes(user.role)}
                  className="mt-1"
                  placeholder="SUPP001"
                />
              </div>
              <div>
                <Label htmlFor="preferredCommunication">Communication Method</Label>
                <select
                  id="preferredCommunication"
                  value={formData.preferredCommunication}
                  onChange={(e) => setFormData(prev => ({ ...prev, preferredCommunication: e.target.value }))}
                  disabled={!isEditing || !['super_admin', 'admin'].includes(user.role)}
                  className="mt-1 w-full h-9 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bdi-green-1 disabled:bg-gray-100 text-sm"
                >
                  <option value="portal">Portal</option>
                  <option value="api">API</option>
                  <option value="edi">EDI</option>
                  <option value="email">Email</option>
                </select>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="standardLeadTime">Standard Lead Time (days)</Label>
                <Input
                  id="standardLeadTime"
                  type="number"
                  value={formData.standardLeadTime}
                  onChange={(e) => setFormData(prev => ({ ...prev, standardLeadTime: e.target.value }))}
                  disabled={!isEditing || !['super_admin', 'admin'].includes(user.role)}
                  className="mt-1"
                  placeholder="30"
                />
              </div>
              <div>
                <Label htmlFor="expeditedLeadTime">Expedited Lead Time (days)</Label>
                <Input
                  id="expeditedLeadTime"
                  type="number"
                  value={formData.expeditedLeadTime}
                  onChange={(e) => setFormData(prev => ({ ...prev, expeditedLeadTime: e.target.value }))}
                  disabled={!isEditing || !['super_admin', 'admin'].includes(user.role)}
                  className="mt-1"
                  placeholder="7"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="minimumOrderQty">Minimum Order Quantity</Label>
                <Input
                  id="minimumOrderQty"
                  type="number"
                  value={formData.minimumOrderQty}
                  onChange={(e) => setFormData(prev => ({ ...prev, minimumOrderQty: e.target.value }))}
                  disabled={!isEditing || !['super_admin', 'admin'].includes(user.role)}
                  className="mt-1"
                  placeholder="100"
                />
              </div>
              <div>
                <Label htmlFor="paymentTerms">Payment Terms</Label>
                <select
                  id="paymentTerms"
                  value={formData.paymentTerms}
                  onChange={(e) => setFormData(prev => ({ ...prev, paymentTerms: e.target.value }))}
                  disabled={!isEditing || !['super_admin', 'admin'].includes(user.role)}
                  className="mt-1 w-full h-9 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bdi-green-1 disabled:bg-gray-100 text-sm"
                >
                  <option value="NET15">NET 15</option>
                  <option value="NET30">NET 30</option>
                  <option value="NET45">NET 45</option>
                  <option value="NET60">NET 60</option>
                  <option value="COD">Cash on Delivery</option>
                  <option value="PREPAID">Prepaid</option>
                </select>
              </div>
            </div>

            <div>
              <Label htmlFor="businessHours">Business Hours & Time Zone</Label>
              <div className="grid grid-cols-2 gap-4 mt-1">
                <Input
                  placeholder="9:00 AM - 5:00 PM"
                  value={formData.businessHours}
                  onChange={(e) => setFormData(prev => ({ ...prev, businessHours: e.target.value }))}
                  disabled={!isEditing || !['super_admin', 'admin'].includes(user.role)}
                />
                <select
                  value={formData.timeZone}
                  onChange={(e) => setFormData(prev => ({ ...prev, timeZone: e.target.value }))}
                  disabled={!isEditing || !['super_admin', 'admin'].includes(user.role)}
                  className="h-9 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bdi-green-1 disabled:bg-gray-100 text-sm"
                >
                  <option value="America/New_York">Eastern Time (EST/EDT)</option>
                  <option value="America/Chicago">Central Time (CST/CDT)</option>
                  <option value="America/Denver">Mountain Time (MST/MDT)</option>
                  <option value="America/Los_Angeles">Pacific Time (PST/PDT)</option>
                  <option value="UTC">UTC</option>
                </select>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Data Exchange Preferences - Full Width */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="flex items-center">
            <SemanticBDIIcon semantic="sync" size={20} className="mr-2" />
            Data Exchange Preferences
          </CardTitle>
          <CardDescription>Technical preferences for API and data integration</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Label className="text-sm font-medium text-gray-700">Supported Data Formats</Label>
              <div className="mt-2 space-y-2">
                {['JSON', 'XML', 'CSV', 'EDI X12', 'EDIFACT'].map((format) => (
                  <label key={format} className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.dataExchangeFormats.includes(format)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setFormData(prev => ({
                            ...prev,
                            dataExchangeFormats: [...prev.dataExchangeFormats, format]
                          }));
                        } else {
                          setFormData(prev => ({
                            ...prev,
                            dataExchangeFormats: prev.dataExchangeFormats.filter(f => f !== format)
                          }));
                        }
                      }}
                      disabled={!isEditing}
                      className="mr-2"
                    />
                    <span className="text-sm">{format}</span>
                  </label>
                ))}
              </div>
            </div>
            
            <div>
              <Label htmlFor="frequencyPreference">Data Exchange Frequency</Label>
              <select
                id="frequencyPreference"
                value={formData.frequencyPreference}
                onChange={(e) => setFormData(prev => ({ ...prev, frequencyPreference: e.target.value }))}
                disabled={!isEditing}
                className="mt-1 w-full h-9 px-2 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bdi-green-1 disabled:bg-gray-100 text-xs"
              >
                <option value="real-time">Real-time</option>
                <option value="hourly">Hourly</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="on-demand">On Demand</option>
              </select>
              
              {user.role === 'developer' && (
                <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-sm text-blue-800">
                    <SemanticBDIIcon semantic="settings" size={16} className="inline mr-1" />
                    API keys and advanced integration settings are available in the <strong>Settings</strong> section.
                  </p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
