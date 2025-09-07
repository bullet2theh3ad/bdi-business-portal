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
import FileUpload from '@/components/FileUpload';
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
    timeZone: 'America/New_York',
    
    // Banking Information
    bankName: '',
    bankAddress: '',
    routingNumber: '',
    accountNumber: '',
    achNumber: '',
    swiftCode: '',
    ibanNumber: '',
    sortCode: '',
    bsbNumber: '',
    branchCode: '',
    correspondentBankName: '',
    correspondentSwiftCode: '',
    intermediaryBankName: '',
    intermediarySwiftCode: '',
    beneficiaryName: '',
    beneficiaryAddress: '',
    wireInstructions: '',
    checkPayableTo: '',
    remittanceAddress: '',
    taxWithholdingInfo: '',
    currencyPreference: 'USD',
    
    // Additional APAC Banking Fields
    bankCode: '',
    institutionNumber: '',
    micr: '',
    ifscCode: '',
    upiId: '',
    chineseUnionPayId: '',
    bankLicenseNumber: '',
    centralBankCode: '',
    nationalIdNumber: ''
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
        primaryContactName: user.primaryContactName || user.name || '',
        primaryContactEmail: user.primaryContactEmail || user.email || '',
        primaryContactPhone: user.primaryContactPhone || user.phone || '',
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
        timeZone: user.timeZone || 'America/New_York',
        
        // Banking Information
        bankName: '',
        bankAddress: '',
        routingNumber: '',
        accountNumber: '',
        achNumber: '',
        swiftCode: '',
        ibanNumber: '',
        sortCode: '',
        bsbNumber: '',
        branchCode: '',
        correspondentBankName: '',
        correspondentSwiftCode: '',
        intermediaryBankName: '',
        intermediarySwiftCode: '',
        beneficiaryName: '',
        beneficiaryAddress: '',
        wireInstructions: '',
        checkPayableTo: '',
        remittanceAddress: '',
        taxWithholdingInfo: '',
        currencyPreference: 'USD',
        
        // Additional APAC Banking Fields
        bankCode: '',
        institutionNumber: '',
        micr: '',
        ifscCode: '',
        upiId: '',
        chineseUnionPayId: '',
        bankLicenseNumber: '',
        centralBankCode: '',
        nationalIdNumber: ''
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
    <div className="flex-1 p-3 sm:p-4 lg:p-8 max-w-4xl mx-auto">
      <div className="mb-6 lg:mb-8">
        <div className="flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
          <div className="flex items-center space-x-3 sm:space-x-4">
            <SemanticBDIIcon semantic="profile" size={24} className="sm:w-8 sm:h-8" />
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold">My Account Profile</h1>
              <p className="text-sm sm:text-base text-muted-foreground">Manage your personal and business information for B2B data exchange</p>
            </div>
          </div>
          <div className="flex flex-col space-y-2 sm:flex-row sm:items-center sm:space-y-0 sm:space-x-2">
            <Badge variant={user.role === 'super_admin' ? 'default' : 'secondary'} className="bg-bdi-green-1 text-white text-xs sm:text-sm">
              {user.role.replace('_', ' ').toUpperCase()}
            </Badge>
            {!isEditing ? (
              <Button onClick={() => setIsEditing(true)} className="bg-bdi-green-1 hover:bg-bdi-green-2 w-full sm:w-auto">
                <SemanticBDIIcon semantic="settings" size={16} className="mr-2 brightness-0 invert" />
                Edit Profile
              </Button>
            ) : (
              <div className="flex flex-col space-y-2 sm:flex-row sm:space-y-0 sm:space-x-2 w-full sm:w-auto">
                <Button variant="outline" onClick={handleCancel} disabled={isSaving} className="w-full sm:w-auto">
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={isSaving} className="w-full sm:w-auto bg-bdi-green-1 hover:bg-bdi-green-2">
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-8">
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-1">
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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
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

          <Separator className="my-6" />

          {/* Business Documents */}
          <div>
            <h4 className="font-medium text-gray-700 mb-4 flex items-center">
              <SemanticBDIIcon semantic="reports" size={16} className="mr-2" />
              Business Documents
            </h4>
            <p className="text-sm text-gray-500 mb-4">
              Upload business registration, licenses, certifications, and other legal documents
            </p>
            {user.organization?.id && (
              <FileUpload
                organizationId={user.organization.id}
                category="business"
                subcategory="registration"
                maxFiles={10}
                maxSizeInMB={50}
                disabled={!isEditing || !['super_admin', 'admin'].includes(user.role)}
                onUploadComplete={(files) => {
                  console.log('Business documents uploaded:', files);
                  // You can add a toast notification here
                }}
                onUploadError={(error) => {
                  console.error('Upload error:', error);
                  // You can add error handling here
                }}
              />
            )}
          </div>
        </CardContent>
      </Card>

      {/* Banking Information - Admin Only */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="flex items-center">
            <SemanticBDIIcon semantic="analytics" size={20} className="mr-2" />
            Banking Information
            <Badge variant="secondary" className="ml-2 text-xs bg-bdi-blue text-white">
              Admin Only
            </Badge>
          </CardTitle>
          <CardDescription>
            Banking details for wire transfers, ACH, and international payments
            <span className="block text-xs text-muted-foreground mt-1">
              Sensitive financial information - Administrator access required
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Primary Banking Information */}
          <div>
            <h4 className="font-medium text-gray-700 mb-4 flex items-center">
              <SemanticBDIIcon semantic="analytics" size={16} className="mr-2" />
              Primary Bank Account
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="bankName">Bank Name</Label>
                <Input
                  id="bankName"
                  value={formData.bankName}
                  onChange={(e) => setFormData(prev => ({ ...prev, bankName: e.target.value }))}
                  disabled={!isEditing || !['super_admin', 'admin'].includes(user.role)}
                  className="mt-1"
                  placeholder="JPMorgan Chase Bank"
                />
              </div>
              <div>
                <Label htmlFor="currencyPreference">Primary Currency</Label>
                <select
                  id="currencyPreference"
                  value={formData.currencyPreference}
                  onChange={(e) => setFormData(prev => ({ ...prev, currencyPreference: e.target.value }))}
                  disabled={!isEditing || !['super_admin', 'admin'].includes(user.role)}
                  className="mt-1 w-full h-9 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bdi-green-1 disabled:bg-gray-100 text-sm"
                >
                  <option value="USD">USD - US Dollar</option>
                  <option value="EUR">EUR - Euro</option>
                  <option value="GBP">GBP - British Pound</option>
                  <option value="CAD">CAD - Canadian Dollar</option>
                  <option value="JPY">JPY - Japanese Yen</option>
                  <option value="AUD">AUD - Australian Dollar</option>
                  <option value="CHF">CHF - Swiss Franc</option>
                  <option value="CNY">CNY - Chinese Yuan</option>
                  <option value="TWD">TWD - Taiwan Dollar</option>
                  <option value="INR">INR - Indian Rupee</option>
                  <option value="VND">VND - Vietnamese Dong</option>
                  <option value="MYR">MYR - Malaysian Ringgit</option>
                  <option value="SGD">SGD - Singapore Dollar</option>
                  <option value="THB">THB - Thai Baht</option>
                  <option value="KRW">KRW - South Korean Won</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="bankAddress">Bank Address</Label>
                <textarea
                  id="bankAddress"
                  value={formData.bankAddress}
                  onChange={(e) => setFormData(prev => ({ ...prev, bankAddress: e.target.value }))}
                  disabled={!isEditing || !['super_admin', 'admin'].includes(user.role)}
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bdi-green-1 disabled:bg-gray-100"
                  rows={2}
                  placeholder="Bank's full address including city, state/province, postal code, country"
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* US Banking Details */}
          <div>
            <h4 className="font-medium text-gray-700 mb-4 flex items-center">
              <SemanticBDIIcon semantic="analytics" size={16} className="mr-2" />
              US Banking Details
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="routingNumber">Routing Number (ABA)</Label>
                <Input
                  id="routingNumber"
                  value={formData.routingNumber}
                  onChange={(e) => setFormData(prev => ({ ...prev, routingNumber: e.target.value }))}
                  disabled={!isEditing || !['super_admin', 'admin'].includes(user.role)}
                  className="mt-1"
                  placeholder="021000021"
                />
              </div>
              <div>
                <Label htmlFor="accountNumber">Account Number</Label>
                <Input
                  id="accountNumber"
                  type="password"
                  value={formData.accountNumber}
                  onChange={(e) => setFormData(prev => ({ ...prev, accountNumber: e.target.value }))}
                  disabled={!isEditing || !['super_admin', 'admin'].includes(user.role)}
                  className="mt-1"
                  placeholder="••••••••••"
                />
              </div>
              <div>
                <Label htmlFor="achNumber">ACH Number</Label>
                <Input
                  id="achNumber"
                  value={formData.achNumber}
                  onChange={(e) => setFormData(prev => ({ ...prev, achNumber: e.target.value }))}
                  disabled={!isEditing || !['super_admin', 'admin'].includes(user.role)}
                  className="mt-1"
                  placeholder="Same as routing or different"
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* International Banking Details */}
          <div>
            <h4 className="font-medium text-gray-700 mb-4 flex items-center">
              <SemanticBDIIcon semantic="sync" size={16} className="mr-2" />
              International Banking Details
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="swiftCode">SWIFT/BIC Code</Label>
                <Input
                  id="swiftCode"
                  value={formData.swiftCode}
                  onChange={(e) => setFormData(prev => ({ ...prev, swiftCode: e.target.value }))}
                  disabled={!isEditing || !['super_admin', 'admin'].includes(user.role)}
                  className="mt-1"
                  placeholder="CHASUS33"
                />
              </div>
              <div>
                <Label htmlFor="ibanNumber">IBAN Number</Label>
                <Input
                  id="ibanNumber"
                  value={formData.ibanNumber}
                  onChange={(e) => setFormData(prev => ({ ...prev, ibanNumber: e.target.value }))}
                  disabled={!isEditing || !['super_admin', 'admin'].includes(user.role)}
                  className="mt-1"
                  placeholder="GB82 WEST 1234 5698 7654 32"
                />
              </div>
              <div>
                <Label htmlFor="sortCode">Sort Code (UK)</Label>
                <Input
                  id="sortCode"
                  value={formData.sortCode}
                  onChange={(e) => setFormData(prev => ({ ...prev, sortCode: e.target.value }))}
                  disabled={!isEditing || !['super_admin', 'admin'].includes(user.role)}
                  className="mt-1"
                  placeholder="12-34-56"
                />
              </div>
              <div>
                <Label htmlFor="bsbNumber">BSB Number (Australia)</Label>
                <Input
                  id="bsbNumber"
                  value={formData.bsbNumber}
                  onChange={(e) => setFormData(prev => ({ ...prev, bsbNumber: e.target.value }))}
                  disabled={!isEditing || !['super_admin', 'admin'].includes(user.role)}
                  className="mt-1"
                  placeholder="123-456"
                />
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="branchCode">Branch Code / Transit Number</Label>
                <Input
                  id="branchCode"
                  value={formData.branchCode}
                  onChange={(e) => setFormData(prev => ({ ...prev, branchCode: e.target.value }))}
                  disabled={!isEditing || !['super_admin', 'admin'].includes(user.role)}
                  className="mt-1"
                  placeholder="For countries requiring branch identification"
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* APAC Banking Details */}
          <div>
            <h4 className="font-medium text-gray-700 mb-4 flex items-center">
              <SemanticBDIIcon semantic="sync" size={16} className="mr-2" />
              APAC Banking Details
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="ifscCode">IFSC Code (India)</Label>
                <Input
                  id="ifscCode"
                  value={formData.ifscCode}
                  onChange={(e) => setFormData(prev => ({ ...prev, ifscCode: e.target.value }))}
                  disabled={!isEditing || !['super_admin', 'admin'].includes(user.role)}
                  className="mt-1"
                  placeholder="HDFC0000001"
                />
              </div>
              <div>
                <Label htmlFor="micr">MICR Code (India)</Label>
                <Input
                  id="micr"
                  value={formData.micr}
                  onChange={(e) => setFormData(prev => ({ ...prev, micr: e.target.value }))}
                  disabled={!isEditing || !['super_admin', 'admin'].includes(user.role)}
                  className="mt-1"
                  placeholder="110240001"
                />
              </div>
              <div>
                <Label htmlFor="upiId">UPI ID (India)</Label>
                <Input
                  id="upiId"
                  value={formData.upiId}
                  onChange={(e) => setFormData(prev => ({ ...prev, upiId: e.target.value }))}
                  disabled={!isEditing || !['super_admin', 'admin'].includes(user.role)}
                  className="mt-1"
                  placeholder="company@paytm"
                />
              </div>
              <div>
                <Label htmlFor="bankCode">Bank Code (China/Taiwan/Malaysia)</Label>
                <Input
                  id="bankCode"
                  value={formData.bankCode}
                  onChange={(e) => setFormData(prev => ({ ...prev, bankCode: e.target.value }))}
                  disabled={!isEditing || !['super_admin', 'admin'].includes(user.role)}
                  className="mt-1"
                  placeholder="012 (ICBC), 700 (Maybank)"
                />
              </div>
              <div>
                <Label htmlFor="chineseUnionPayId">China UnionPay ID</Label>
                <Input
                  id="chineseUnionPayId"
                  value={formData.chineseUnionPayId}
                  onChange={(e) => setFormData(prev => ({ ...prev, chineseUnionPayId: e.target.value }))}
                  disabled={!isEditing || !['super_admin', 'admin'].includes(user.role)}
                  className="mt-1"
                  placeholder="For UnionPay transactions"
                />
              </div>
              <div>
                <Label htmlFor="institutionNumber">Institution Number</Label>
                <Input
                  id="institutionNumber"
                  value={formData.institutionNumber}
                  onChange={(e) => setFormData(prev => ({ ...prev, institutionNumber: e.target.value }))}
                  disabled={!isEditing || !['super_admin', 'admin'].includes(user.role)}
                  className="mt-1"
                  placeholder="Financial institution identifier"
                />
              </div>
              <div>
                <Label htmlFor="centralBankCode">Central Bank Code</Label>
                <Input
                  id="centralBankCode"
                  value={formData.centralBankCode}
                  onChange={(e) => setFormData(prev => ({ ...prev, centralBankCode: e.target.value }))}
                  disabled={!isEditing || !['super_admin', 'admin'].includes(user.role)}
                  className="mt-1"
                  placeholder="Central bank registration code"
                />
              </div>
              <div>
                <Label htmlFor="bankLicenseNumber">Bank License Number</Label>
                <Input
                  id="bankLicenseNumber"
                  value={formData.bankLicenseNumber}
                  onChange={(e) => setFormData(prev => ({ ...prev, bankLicenseNumber: e.target.value }))}
                  disabled={!isEditing || !['super_admin', 'admin'].includes(user.role)}
                  className="mt-1"
                  placeholder="Banking license/permit number"
                />
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="nationalIdNumber">National ID / Tax Number</Label>
                <Input
                  id="nationalIdNumber"
                  value={formData.nationalIdNumber}
                  onChange={(e) => setFormData(prev => ({ ...prev, nationalIdNumber: e.target.value }))}
                  disabled={!isEditing || !['super_admin', 'admin'].includes(user.role)}
                  className="mt-1"
                  placeholder="Company registration number, tax ID, or national identifier"
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Correspondent & Intermediary Banks */}
          <div>
            <h4 className="font-medium text-gray-700 mb-4 flex items-center">
              <SemanticBDIIcon semantic="connect" size={16} className="mr-2" />
              Correspondent & Intermediary Banks
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="correspondentBankName">Correspondent Bank Name</Label>
                <Input
                  id="correspondentBankName"
                  value={formData.correspondentBankName}
                  onChange={(e) => setFormData(prev => ({ ...prev, correspondentBankName: e.target.value }))}
                  disabled={!isEditing || !['super_admin', 'admin'].includes(user.role)}
                  className="mt-1"
                  placeholder="For international wire transfers"
                />
              </div>
              <div>
                <Label htmlFor="correspondentSwiftCode">Correspondent SWIFT Code</Label>
                <Input
                  id="correspondentSwiftCode"
                  value={formData.correspondentSwiftCode}
                  onChange={(e) => setFormData(prev => ({ ...prev, correspondentSwiftCode: e.target.value }))}
                  disabled={!isEditing || !['super_admin', 'admin'].includes(user.role)}
                  className="mt-1"
                  placeholder="CHASUS33XXX"
                />
              </div>
              <div>
                <Label htmlFor="intermediaryBankName">Intermediary Bank Name</Label>
                <Input
                  id="intermediaryBankName"
                  value={formData.intermediaryBankName}
                  onChange={(e) => setFormData(prev => ({ ...prev, intermediaryBankName: e.target.value }))}
                  disabled={!isEditing || !['super_admin', 'admin'].includes(user.role)}
                  className="mt-1"
                  placeholder="If required for routing"
                />
              </div>
              <div>
                <Label htmlFor="intermediarySwiftCode">Intermediary SWIFT Code</Label>
                <Input
                  id="intermediarySwiftCode"
                  value={formData.intermediarySwiftCode}
                  onChange={(e) => setFormData(prev => ({ ...prev, intermediarySwiftCode: e.target.value }))}
                  disabled={!isEditing || !['super_admin', 'admin'].includes(user.role)}
                  className="mt-1"
                  placeholder="For complex routing"
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Beneficiary Information */}
          <div>
            <h4 className="font-medium text-gray-700 mb-4 flex items-center">
              <SemanticBDIIcon semantic="collaboration" size={16} className="mr-2" />
              Beneficiary Information
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="beneficiaryName">Beneficiary Name</Label>
                <Input
                  id="beneficiaryName"
                  value={formData.beneficiaryName}
                  onChange={(e) => setFormData(prev => ({ ...prev, beneficiaryName: e.target.value }))}
                  disabled={!isEditing || !['super_admin', 'admin'].includes(user.role)}
                  className="mt-1"
                  placeholder="Boundless Devices Inc"
                />
              </div>
              <div>
                <Label htmlFor="checkPayableTo">Check Payable To</Label>
                <Input
                  id="checkPayableTo"
                  value={formData.checkPayableTo}
                  onChange={(e) => setFormData(prev => ({ ...prev, checkPayableTo: e.target.value }))}
                  disabled={!isEditing || !['super_admin', 'admin'].includes(user.role)}
                  className="mt-1"
                  placeholder="Exact name for check payments"
                />
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="beneficiaryAddress">Beneficiary Address</Label>
                <textarea
                  id="beneficiaryAddress"
                  value={formData.beneficiaryAddress}
                  onChange={(e) => setFormData(prev => ({ ...prev, beneficiaryAddress: e.target.value }))}
                  disabled={!isEditing || !['super_admin', 'admin'].includes(user.role)}
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bdi-green-1 disabled:bg-gray-100"
                  rows={2}
                  placeholder="Complete beneficiary address for wire transfers"
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Payment Instructions & Special Requirements */}
          <div>
            <h4 className="font-medium text-gray-700 mb-4 flex items-center">
              <SemanticBDIIcon semantic="reports" size={16} className="mr-2" />
              Payment Instructions & Tax Information
            </h4>
            <div className="space-y-4">
              <div>
                <Label htmlFor="wireInstructions">Wire Transfer Instructions</Label>
                <textarea
                  id="wireInstructions"
                  value={formData.wireInstructions}
                  onChange={(e) => setFormData(prev => ({ ...prev, wireInstructions: e.target.value }))}
                  disabled={!isEditing || !['super_admin', 'admin'].includes(user.role)}
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bdi-green-1 disabled:bg-gray-100"
                  rows={3}
                  placeholder="Special instructions for wire transfers (reference numbers, purpose codes, etc.)"
                />
              </div>
              <div>
                <Label htmlFor="remittanceAddress">Remittance Address</Label>
                <textarea
                  id="remittanceAddress"
                  value={formData.remittanceAddress}
                  onChange={(e) => setFormData(prev => ({ ...prev, remittanceAddress: e.target.value }))}
                  disabled={!isEditing || !['super_admin', 'admin'].includes(user.role)}
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bdi-green-1 disabled:bg-gray-100"
                  rows={2}
                  placeholder="Address for sending checks and remittance advice"
                />
              </div>
              <div>
                <Label htmlFor="taxWithholdingInfo">Tax Withholding Information</Label>
                <textarea
                  id="taxWithholdingInfo"
                  value={formData.taxWithholdingInfo}
                  onChange={(e) => setFormData(prev => ({ ...prev, taxWithholdingInfo: e.target.value }))}
                  disabled={!isEditing || !['super_admin', 'admin'].includes(user.role)}
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bdi-green-1 disabled:bg-gray-100"
                  rows={2}
                  placeholder="Tax withholding requirements, W-8/W-9 status, exemptions"
                />
              </div>
            </div>
          </div>

          {['super_admin', 'admin'].includes(user.role) && (
            <>
              <Separator className="my-6" />
              
              {/* Banking Documents */}
              <div>
                <h4 className="font-medium text-gray-700 mb-4 flex items-center">
                  <SemanticBDIIcon semantic="reports" size={16} className="mr-2" />
                  Banking Documents
                </h4>
                <p className="text-sm text-gray-500 mb-4">
                  Upload bank statements, wire instructions, ACH forms, and other banking documentation
                </p>
                {user.organization?.id && (
                  <FileUpload
                    organizationId={user.organization.id}
                    category="banking"
                    subcategory="statements"
                    maxFiles={15}
                    maxSizeInMB={50}
                    disabled={!isEditing}
                    onUploadComplete={(files) => {
                      console.log('Banking documents uploaded:', files);
                    }}
                    onUploadError={(error) => {
                      console.error('Banking upload error:', error);
                    }}
                  />
                )}
              </div>
            </>
          )}

          {!['super_admin', 'admin'].includes(user.role) && (
            <div className="mt-6 p-4 bg-bdi-blue/5 border border-bdi-blue/20 rounded-lg">
              <div className="flex items-center">
                <SemanticBDIIcon semantic="settings" size={16} className="mr-2 text-bdi-blue" />
                <div>
                  <p className="text-sm font-medium text-bdi-blue">Restricted Access</p>
                  <p className="text-xs text-gray-600">Banking information is only accessible to administrators for security and compliance reasons.</p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Legal & Compliance Documents */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="flex items-center">
            <SemanticBDIIcon semantic="reports" size={20} className="mr-2" />
            Legal & Compliance Documents
          </CardTitle>
          <CardDescription>
            Upload contracts, NDAs, compliance certificates, and other legal documentation
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
            {/* Contracts & Agreements */}
            <div>
              <h4 className="font-medium text-gray-700 mb-4 flex items-center">
                <SemanticBDIIcon semantic="collaboration" size={16} className="mr-2" />
                Contracts & Agreements
              </h4>
              <p className="text-sm text-gray-500 mb-4">
                NDAs, service agreements, partnership contracts
              </p>
              {user.organization?.id && (
                <FileUpload
                  organizationId={user.organization.id}
                  category="legal"
                  subcategory="contracts"
                  maxFiles={20}
                  maxSizeInMB={50}
                  disabled={!isEditing || !['super_admin', 'admin'].includes(user.role)}
                  onUploadComplete={(files) => {
                    console.log('Contract documents uploaded:', files);
                  }}
                  onUploadError={(error) => {
                    console.error('Contract upload error:', error);
                  }}
                />
              )}
            </div>

            {/* Compliance & Certifications */}
            <div>
              <h4 className="font-medium text-gray-700 mb-4 flex items-center">
                <SemanticBDIIcon semantic="settings" size={16} className="mr-2" />
                Compliance & Certifications
              </h4>
              <p className="text-sm text-gray-500 mb-4">
                ISO certificates, compliance reports, audit documents
              </p>
              {user.organization?.id && (
                <FileUpload
                  organizationId={user.organization.id}
                  category="compliance"
                  subcategory="certificates"
                  maxFiles={15}
                  maxSizeInMB={50}
                  disabled={!isEditing || !['super_admin', 'admin'].includes(user.role)}
                  onUploadComplete={(files) => {
                    console.log('Compliance documents uploaded:', files);
                  }}
                  onUploadError={(error) => {
                    console.error('Compliance upload error:', error);
                  }}
                />
              )}
            </div>
          </div>

          {!['super_admin', 'admin'].includes(user.role) && (
            <div className="mt-6 p-4 bg-bdi-blue/5 border border-bdi-blue/20 rounded-lg">
              <div className="flex items-center">
                <SemanticBDIIcon semantic="settings" size={16} className="mr-2 text-bdi-blue" />
                <div>
                  <p className="text-sm font-medium text-bdi-blue">Restricted Access</p>
                  <p className="text-xs text-gray-600">Legal and compliance documents are only accessible to administrators for security reasons.</p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
