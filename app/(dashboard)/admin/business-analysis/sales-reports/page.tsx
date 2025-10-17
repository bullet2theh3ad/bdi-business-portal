'use client';

import { useState } from 'react';
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

// Default reports - easily updatable
const DEFAULT_REPORTS: ReportSource[] = [
  {
    id: 'harpia-sales',
    name: 'Harpia Sales Dashboard',
    url: 'https://reports.harpia.co/shared/yW1gQ5NQB2J8dbAj#tab:900448',
    description: 'Main sales reporting and analytics dashboard',
    icon: '📊',
    color: 'blue'
  },
  // Add more reports here as needed
];

export default function SalesReportsPage() {
  const [reports, setReports] = useState<ReportSource[]>(DEFAULT_REPORTS);
  const [selectedReport, setSelectedReport] = useState<ReportSource | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [editingReport, setEditingReport] = useState<ReportSource | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);

  // Form state for editing/adding reports
  const [formData, setFormData] = useState({
    name: '',
    url: '',
    description: '',
    icon: '📊',
    color: 'blue'
  });

  const handleSelectReport = (report: ReportSource) => {
    setSelectedReport(report);
    setIsFullscreen(false);
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

  const handleSaveReport = () => {
    if (editingReport) {
      // Update existing
      setReports(reports.map(r => 
        r.id === editingReport.id 
          ? { ...editingReport, ...formData }
          : r
      ));
    } else if (isAddingNew) {
      // Add new
      const newReport: ReportSource = {
        id: `custom-${Date.now()}`,
        ...formData
      };
      setReports([...reports, newReport]);
    }
    setEditingReport(null);
    setIsAddingNew(false);
  };

  const handleDeleteReport = (reportId: string) => {
    if (confirm('Are you sure you want to delete this report?')) {
      setReports(reports.filter(r => r.id !== reportId));
      if (selectedReport?.id === reportId) {
        setSelectedReport(null);
      }
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
      <div className="bg-white border-b px-6 py-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Sales Reports</h1>
            <p className="text-sm text-gray-600 mt-1">External sales reporting and analytics dashboards</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleOpenSettings}
            >
              <Settings className="w-4 h-4 mr-2" />
              Manage Reports
            </Button>
            {selectedReport && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsFullscreen(!isFullscreen)}
                >
                  <Maximize2 className="w-4 h-4 mr-2" />
                  {isFullscreen ? 'Exit' : 'Fullscreen'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(selectedReport.url, '_blank')}
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Open in New Tab
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden flex">
        {/* Sidebar - Report Selection */}
        {!isFullscreen && (
          <div className="w-80 bg-white border-r overflow-y-auto flex-shrink-0">
            <div className="p-4 space-y-3">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
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
                      p-4 rounded-lg border-2 cursor-pointer transition-all
                      ${isActive 
                        ? `${colors.bg} ${colors.border} ring-2 ring-offset-2 ring-${report.color}-500` 
                        : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm'}
                    `}
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-2xl">{report.icon}</span>
                      <div className="flex-1 min-w-0">
                        <h3 className={`font-semibold text-sm ${isActive ? colors.text : 'text-gray-900'}`}>
                          {report.name}
                        </h3>
                        <p className="text-xs text-gray-500 mt-1 line-clamp-2">
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
            <iframe
              src={selectedReport.url}
              className="w-full h-full border-0"
              title={selectedReport.name}
              allow="fullscreen"
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center max-w-md px-6">
                <div className="text-6xl mb-4">📊</div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  Select a Report
                </h2>
                <p className="text-gray-600 mb-6">
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

      {/* Settings Modal */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Manage Sales Reports</DialogTitle>
            <DialogDescription>
              Add, edit, or remove external sales reporting dashboards
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            {/* Report List */}
            <div className="space-y-3">
              {reports.map((report) => (
                <Card key={report.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 flex-1">
                        <span className="text-2xl">{report.icon}</span>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-sm">{report.name}</h4>
                          <p className="text-xs text-gray-500 mt-1">{report.description}</p>
                          <p className="text-xs text-blue-600 mt-2 truncate">{report.url}</p>
                        </div>
                      </div>
                      <div className="flex gap-2 ml-4">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEditReport(report)}
                        >
                          <Edit2 className="w-3 h-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDeleteReport(report.id)}
                        >
                          <Trash2 className="w-3 h-3 text-red-600" />
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
            >
              <Plus className="w-4 h-4 mr-2" />
              Add New Report
            </Button>

            {/* Edit/Add Form */}
            {(editingReport || isAddingNew) && (
              <Card className="border-2 border-blue-500">
                <CardHeader>
                  <CardTitle className="text-lg">
                    {editingReport ? 'Edit Report' : 'Add New Report'}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Report Name</label>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g., Harpia Sales Dashboard"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Report URL</label>
                    <Input
                      value={formData.url}
                      onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                      placeholder="https://reports.example.com/..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Description</label>
                    <Input
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Brief description of this report"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Icon (Emoji)</label>
                      <Input
                        value={formData.icon}
                        onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                        placeholder="📊"
                        maxLength={2}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Color</label>
                      <select
                        value={formData.color}
                        onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                        className="w-full h-10 px-3 border rounded-md"
                      >
                        <option value="blue">Blue</option>
                        <option value="green">Green</option>
                        <option value="purple">Purple</option>
                        <option value="red">Red</option>
                        <option value="orange">Orange</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handleSaveReport} className="flex-1">
                      Save Report
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setEditingReport(null);
                        setIsAddingNew(false);
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

