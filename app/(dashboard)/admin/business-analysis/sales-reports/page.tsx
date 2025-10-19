'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ExternalLink, RefreshCw, Maximize2, Settings, Plus, Trash2, Edit2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

// Configurable report sources
interface ReportSource {
  id: string;
  name: string;
  url: string;
  description: string;
  icon: string;
  color: string;
}

export default function SalesReportsPage() {
  const [reports, setReports] = useState<ReportSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<ReportSource | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [editingReport, setEditingReport] = useState<ReportSource | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [iframeError, setIframeError] = useState(false);

  // Form state for editing/adding reports
  const [formData, setFormData] = useState({
    name: '',
    url: '',
    description: '',
    icon: '📊',
    color: 'blue'
  });
  const [saving, setSaving] = useState(false);

  // Fetch reports on mount
  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/business-analysis/sales-reports');
      if (response.ok) {
        const data = await response.json();
        setReports(data.reports || []);
      } else {
        console.error('Failed to fetch reports');
      }
    } catch (error) {
      console.error('Error fetching reports:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectReport = (report: ReportSource) => {
    setSelectedReport(report);
    setIsFullscreen(false);
    setIframeError(false); // Reset error state
  };

  const handleOpenSettings = () => {
    setShowSettings(true);
  };

  const handleEditReport = (report: ReportSource) => {
    setEditingReport(report);
    setFormData({
      name: report.name,
      url: report.url,
      description: report.description,
      icon: report.icon,
      color: report.color
    });
    setIsAddingNew(false);
  };

  const handleAddNew = () => {
    setEditingReport(null);
    setFormData({
      name: '',
      url: '',
      description: '',
      icon: '📊',
      color: 'blue'
    });
    setIsAddingNew(true);
  };

  const handleSaveReport = async () => {
    if (!formData.name || !formData.url) {
      alert('Name and URL are required');
      return;
    }

    try {
      setSaving(true);
      
      if (editingReport) {
        // Update existing
        const response = await fetch(`/api/business-analysis/sales-reports/${editingReport.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });

        if (response.ok) {
          const data = await response.json();
          setReports(reports.map(r => r.id === editingReport.id ? data.report : r));
        } else {
          const error = await response.json();
          alert(`Failed to update report: ${error.error}`);
          return;
        }
      } else if (isAddingNew) {
        // Add new
        const response = await fetch('/api/business-analysis/sales-reports', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });

        if (response.ok) {
          const data = await response.json();
          setReports([...reports, data.report]);
        } else {
          const error = await response.json();
          alert(`Failed to create report: ${error.error}`);
          return;
        }
      }

      setEditingReport(null);
      setIsAddingNew(false);
    } catch (error) {
      console.error('Error saving report:', error);
      alert('Failed to save report');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteReport = async (reportId: string) => {
    if (!confirm('Are you sure you want to delete this report?')) {
      return;
    }

    try {
      const response = await fetch(`/api/business-analysis/sales-reports/${reportId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setReports(reports.filter(r => r.id !== reportId));
        if (selectedReport?.id === reportId) {
          setSelectedReport(null);
        }
      } else {
        const error = await response.json();
        alert(`Failed to delete report: ${error.error}`);
      }
    } catch (error) {
      console.error('Error deleting report:', error);
      alert('Failed to delete report');
    }
  };

  const colorClasses: Record<string, { bg: string; text: string; border: string }> = {
    blue: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
    green: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
    purple: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
    red: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
    orange: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-3 sm:px-6 py-3 sm:py-4 flex-shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h1 className="text-lg sm:text-2xl font-bold text-gray-900">Sales Reports</h1>
            <p className="text-xs sm:text-sm text-gray-600 mt-1 hidden sm:block">
              External sales reporting and analytics dashboards
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={handleOpenSettings}
              className="flex-1 sm:flex-none"
            >
              <Settings className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Manage Reports</span>
              <span className="sm:hidden">Manage</span>
            </Button>
            {selectedReport && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsFullscreen(!isFullscreen)}
                  className="flex-1 sm:flex-none"
                >
                  <Maximize2 className="w-4 h-4 sm:mr-2" />
                  <span className="hidden sm:inline">{isFullscreen ? 'Exit' : 'Fullscreen'}</span>
                  <span className="sm:hidden">{isFullscreen ? 'Exit' : 'Full'}</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(selectedReport.url, '_blank')}
                  className="flex-1 sm:flex-none"
                >
                  <ExternalLink className="w-4 h-4 sm:mr-2" />
                  <span className="hidden sm:inline">Open in New Tab</span>
                  <span className="sm:hidden">Open</span>
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden flex flex-col sm:flex-row">
        {/* Sidebar - Report Selection */}
        {!isFullscreen && (
          <div className="w-full sm:w-80 bg-white border-r border-b sm:border-b-0 overflow-y-auto flex-shrink-0 max-h-48 sm:max-h-none">
            <div className="p-3 sm:p-4 space-y-2 sm:space-y-3">
              <h2 className="text-xs sm:text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2 sm:mb-4">
                Available Reports
              </h2>
              {reports.map((report) => {
                const colors = colorClasses[report.color] || colorClasses.blue;
                const isActive = selectedReport?.id === report.id;
                
                return (
                  <div
                    key={report.id}
                    onClick={() => handleSelectReport(report)}
                    className={`
                      p-3 sm:p-4 rounded-lg border-2 cursor-pointer transition-all
                      ${isActive 
                        ? `${colors.bg} ${colors.border} ring-2 ring-offset-2 ring-${report.color}-500` 
                        : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm'}
                    `}
                  >
                    <div className="flex items-start gap-2 sm:gap-3">
                      <span className="text-xl sm:text-2xl flex-shrink-0">{report.icon}</span>
                      <div className="flex-1 min-w-0">
                        <h3 className={`font-semibold text-xs sm:text-sm ${isActive ? colors.text : 'text-gray-900'}`}>
                          {report.name}
                        </h3>
                        <p className="text-xs text-gray-500 mt-1 line-clamp-2 hidden sm:block">
                          {report.description}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}

              {reports.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <p className="text-sm">No reports configured</p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleAddNew}
                    className="mt-4"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add First Report
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Report Viewer */}
        <div className="flex-1 overflow-hidden relative bg-white">
          {selectedReport ? (
            <>
              {iframeError && (
                <div className="absolute inset-0 flex items-center justify-center bg-white z-10">
                  <div className="text-center max-w-md px-6">
                    <div className="text-6xl mb-4">⚠️</div>
                    <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">
                      Report Failed to Load
                    </h2>
                    <p className="text-sm sm:text-base text-gray-600 mb-4">
                      The report URL may be incorrect, expired, or the report may have been deleted.
                    </p>
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mb-4">
                      <p className="text-xs text-gray-500 mb-1">Current URL:</p>
                      <p className="text-xs font-mono text-gray-700 break-all">{selectedReport.url}</p>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2 justify-center">
                      <Button onClick={() => setIframeError(false)} variant="outline" size="sm">
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Retry
                      </Button>
                      <Button onClick={handleOpenSettings} size="sm">
                        <Edit2 className="w-4 h-4 mr-2" />
                        Update URL
                      </Button>
                    </div>
                  </div>
                </div>
              )}
              <iframe
                src={selectedReport.url}
                className="w-full h-full border-0"
                title={selectedReport.name}
                allow="fullscreen"
                onError={() => setIframeError(true)}
              />
            </>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center max-w-md px-4 sm:px-6">
                <div className="text-4xl sm:text-6xl mb-4">📊</div>
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">
                  Select a Report
                </h2>
                <p className="text-sm sm:text-base text-gray-600 mb-6">
                  Choose a sales report from the sidebar to view embedded analytics and dashboards
                </p>
                {reports.length === 0 && (
                  <Button onClick={handleOpenSettings}>
                    <Plus className="w-4 h-4 mr-2" />
                    Configure Reports
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Settings Modal - Full Screen */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="w-screen h-screen max-w-none max-h-none m-0 p-0 rounded-none flex flex-col">
          <DialogHeader className="flex-shrink-0 px-6 py-4 border-b bg-white">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-xl sm:text-2xl">Manage Sales Reports</DialogTitle>
                <DialogDescription className="text-sm sm:text-base mt-1">
                  Add, edit, or remove external sales reporting dashboards
                </DialogDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowSettings(false)}
                className="ml-4"
              >
                Close
              </Button>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-gray-50">
            <div className="max-w-4xl mx-auto space-y-4">
              {/* Report List */}
              <div className="space-y-3">
                {reports.map((report) => (
                  <Card key={report.id}>
                    <CardContent className="p-3 sm:p-4">
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <span className="text-2xl flex-shrink-0">{report.icon}</span>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-sm sm:text-base">{report.name}</h4>
                            <p className="text-xs sm:text-sm text-gray-500 mt-1">{report.description}</p>
                            <p className="text-xs text-blue-600 mt-2 break-all">{report.url}</p>
                          </div>
                        </div>
                        <div className="flex gap-2 sm:ml-4 self-end sm:self-start">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEditReport(report)}
                          >
                            <Edit2 className="w-3 h-3 sm:mr-2" />
                            <span className="hidden sm:inline">Edit</span>
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDeleteReport(report.id)}
                          >
                            <Trash2 className="w-3 h-3 text-red-600 sm:mr-2" />
                            <span className="hidden sm:inline">Delete</span>
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Add New Button */}
              <Button
                onClick={handleAddNew}
                className="w-full"
                variant="outline"
                size="lg"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add New Report
              </Button>

              {/* Edit/Add Form */}
              {(editingReport || isAddingNew) && (
                <Card className="border-2 border-blue-500">
                  <CardHeader>
                    <CardTitle className="text-base sm:text-lg">
                      {editingReport ? 'Edit Report' : 'Add New Report'}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Report Name *</label>
                      <Input
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="e.g., Harpia Sales Dashboard"
                        className="text-base"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Report URL *</label>
                      <Input
                        value={formData.url}
                        onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                        placeholder="https://reports.example.com/..."
                        className="text-base"
                        type="url"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Full URL to the external reporting dashboard
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Description</label>
                      <Input
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        placeholder="Brief description of this report"
                        className="text-base"
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-2">Icon (Emoji)</label>
                        <Input
                          value={formData.icon}
                          onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                          placeholder="📊"
                          maxLength={2}
                          className="text-2xl text-center"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2">Color</label>
                        <select
                          value={formData.color}
                          onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                          className="w-full h-10 px-3 border rounded-md text-base"
                        >
                          <option value="blue">Blue</option>
                          <option value="green">Green</option>
                          <option value="purple">Purple</option>
                          <option value="red">Red</option>
                          <option value="orange">Orange</option>
                        </select>
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2 pt-2">
                      <Button
                        onClick={handleSaveReport} 
                        className="flex-1"
                        size="lg"
                        disabled={!formData.name || !formData.url || saving}
                      >
                        {saving ? 'Saving...' : 'Save Report'}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setEditingReport(null);
                          setIsAddingNew(false);
                        }}
                        size="lg"
                        className="flex-1 sm:flex-none"
                      >
                        Cancel
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

