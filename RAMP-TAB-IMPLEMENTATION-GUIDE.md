# Ramp Tab Implementation Guide

## Summary
Adding a third tab called "Ramp" to the GL Code Assignment page for uploading and managing Ramp Register transactions.

## Completed Steps

### 1. Database Schema ✅
- Created `create-ramp-transactions-table.sql`
- Table: `ramp_transactions`
- Columns: All Ramp Register fields (Date, Ref No., Payee, Memo, Class, Foreign Currency, Charge USD, Payment USD, etc.)
- Includes categorization fields (category, account_type)
- Includes matching fields (is_matched, matched_qb_transaction_id)

### 2. API Endpoints ✅
- Created `/api/gl-management/ramp-transactions/upload/route.ts` (POST)
  - Handles XLS/XLSX file upload
  - Skips row 1 (title header)
  - Reads headers from row 2
  - Parses data starting from row 3
  - Maps all Ramp columns to database fields
  
- Created `/api/gl-management/ramp-transactions/route.ts` (GET, PUT, DELETE)
  - GET: Fetch Ramp transactions with filters
  - PUT: Update transaction (inline editing)
  - DELETE: Remove transaction

### 3. Frontend Type Definition ✅
- Added `RampTransaction` interface to page.tsx
- All fields from Ramp Register mapped

## Remaining Frontend Changes Needed

### In page.tsx:

1. **Add State** (around line 124):
```typescript
const [rampTransactions, setRampTransactions] = useState<RampTransaction[]>([]);
```

2. **Update viewMode type** (around line 160):
```typescript
const [viewMode, setViewMode] = useState<'transactions' | 'bank' | 'ramp'>('transactions');
```

3. **Add rampDateRange state** (around line 174):
```typescript
const [rampDateRange, setRampDateRange] = useState<{ earliest: string; latest: string } | null>(null);
```

4. **Update loadAllData** (around line 191):
```typescript
await Promise.all([
  loadTransactions(),
  loadBankStatements(),
  loadRampTransactions(), // ADD THIS
  loadSummary(),
]);
```

5. **Add loadRampTransactions function** (after loadBankStatements):
```typescript
async function loadRampTransactions() {
  try {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    
    const response = await fetch(`/api/gl-management/ramp-transactions?${params}`);
    if (!response.ok) throw new Error('Failed to fetch Ramp transactions');
    
    const data = await response.json();
    setRampTransactions(data);
    
    // Calculate date range
    if (data.length > 0) {
      const dates = data.map((t: RampTransaction) => t.transaction_date).sort();
      setRampDateRange({ earliest: dates[0], latest: dates[dates.length - 1] });
    }
    
    console.log(`✅ Loaded ${data.length} Ramp transactions`);
  } catch (error) {
    console.error('Error loading Ramp transactions:', error);
  }
}
```

6. **Add handleRampFileUpload function** (after handleFileUpload):
```typescript
async function handleRampFileUpload(event: React.ChangeEvent<HTMLInputElement>) {
  const file = event.target.files?.[0];
  if (!file) return;

  try {
    setUploadError(null);
    setUploadSuccess(null);
    
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch('/api/gl-management/ramp-transactions/upload', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.details || 'Upload failed');
    }

    const result = await response.json();
    setUploadSuccess(`✅ Imported ${result.imported} Ramp transactions${result.skipped ? `, skipped ${result.skipped}` : ''}`);
    
    // Reload data
    await loadRampTransactions();
    await loadSummary();
    
    // Clear file input
    event.target.value = '';
  } catch (error: any) {
    console.error('Error uploading Ramp file:', error);
    setUploadError(error.message || 'Failed to upload Ramp file');
  }
}
```

7. **Add Ramp tab button** (in the tab button section, around line 873):
```typescript
<Button
  variant={viewMode === 'ramp' ? 'default' : 'outline'}
  onClick={() => setViewMode('ramp')}
  className="flex-1"
>
  <FileText className="mr-2 h-4 w-4" />
  Ramp Register
  {rampDateRange && (
    <Badge variant="secondary" className="ml-2 text-[10px]">
      {formatDate(rampDateRange.earliest)} - {formatDate(rampDateRange.latest)}
    </Badge>
  )}
</Button>
```

8. **Add Ramp file upload button** (next to Bank upload):
```typescript
{viewMode === 'ramp' && (
  <>
    <input
      type="file"
      id="ramp-file-upload"
      accept=".xls,.xlsx"
      onChange={handleRampFileUpload}
      className="hidden"
    />
    <Button
      variant="outline"
      onClick={() => document.getElementById('ramp-file-upload')?.click()}
      type="button"
    >
      <Upload className="mr-2 h-4 w-4" />
      Upload Ramp File (XLS/XLSX)
    </Button>
  </>
)}
```

9. **Add RampTransactionsView component** (at the end, before closing braces):
```typescript
{!isLoading && viewMode === 'ramp' && (
  <RampTransactionsView
    transactions={filteredRampTransactions}
    onUpdate={loadRampTransactions}
    onSummaryUpdate={loadSummary}
  />
)}
```

10. **Add filteredRampTransactions** (with other filtered data):
```typescript
const filteredRampTransactions = rampTransactions.filter((t) => {
  // Search filter
  if (searchQuery) {
    const query = searchQuery.toLowerCase();
    if (
      !(t.payee || '').toLowerCase().includes(query) &&
      !(t.memo || '').toLowerCase().includes(query) &&
      !(t.account_type || '').toLowerCase().includes(query) &&
      !(t.category || '').toLowerCase().includes(query) &&
      !(t.notes || '').toLowerCase().includes(query)
    ) {
      return false;
    }
  }

  // Category filter
  if (categoryFilter !== 'all' && t.category !== categoryFilter) {
    return false;
  }

  return true;
});
```

11. **Add RampTransactionsView Component** (at the very end of file, after BankStatementsView):
```typescript
// Ramp Transactions View Component
function RampTransactionsView({
  transactions,
  onUpdate,
  onSummaryUpdate,
}: {
  transactions: RampTransaction[];
  onUpdate: () => void;
  onSummaryUpdate: () => void;
}) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Ramp Register Transactions ({transactions.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {/* Header Row */}
            <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-gray-100 rounded font-semibold text-xs">
              <div className="col-span-1">Date</div>
              <div className="col-span-1">Ref No.</div>
              <div className="col-span-2">Payee</div>
              <div className="col-span-2">Memo</div>
              <div className="col-span-1 text-right">Charge</div>
              <div className="col-span-1 text-right">Payment</div>
              <div className="col-span-2">Account Type → Category</div>
              <div className="col-span-1 text-center">Matched</div>
              <div className="col-span-1">Notes</div>
            </div>

            {/* Transaction Rows */}
            {transactions.map((transaction) => (
              <RampTransactionRow
                key={transaction.id}
                transaction={transaction}
                onUpdate={onUpdate}
                onSummaryUpdate={onSummaryUpdate}
              />
            ))}

            {transactions.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                No Ramp transactions. Upload a Ramp Register file to get started.
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Ramp Transaction Row Component with inline editing
function RampTransactionRow({
  transaction,
  onUpdate,
  onSummaryUpdate,
}: {
  transaction: RampTransaction;
  onUpdate: () => void;
  onSummaryUpdate: () => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedAccountType, setEditedAccountType] = useState(transaction.account_type || 'Unclassified');
  const [editedCategory, setEditedCategory] = useState(transaction.category || 'unassigned');
  const [editedNotes, setEditedNotes] = useState(transaction.notes || '');
  const [editedIsMatched, setEditedIsMatched] = useState(transaction.is_matched || false);
  
  const accountTypesByCategory = getAccountTypesByCategory();

  const handleAccountTypeChange = (accountType: string) => {
    setEditedAccountType(accountType);
    // Auto-set category based on account type
    const category = getCategoryForAccountType(accountType);
    if (category) {
      setEditedCategory(category);
    }
  };

  const handleSave = async () => {
    try {
      const response = await fetch('/api/gl-management/ramp-transactions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: transaction.id,
          account_type: editedAccountType,
          category: editedCategory,
          notes: editedNotes,
          is_matched: editedIsMatched,
        }),
      });

      if (!response.ok) throw new Error('Failed to update');

      setIsEditing(false);
      onUpdate();
      onSummaryUpdate();
    } catch (error) {
      console.error('Error saving Ramp transaction:', error);
      alert('Failed to save changes');
    }
  };

  const handleCancel = () => {
    setEditedAccountType(transaction.account_type || 'Unclassified');
    setEditedCategory(transaction.category || 'unassigned');
    setEditedNotes(transaction.notes || '');
    setEditedIsMatched(transaction.is_matched || false);
    setIsEditing(false);
  };

  const formatCurrency = (amount: number | null) => {
    if (amount === null || amount === undefined) return '-';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(Math.abs(amount));
  };

  return (
    <div className="grid grid-cols-12 gap-2 px-4 py-2 border-b hover:bg-gray-50 text-sm items-center">
      {/* Date */}
      <div className="col-span-1 text-xs">
        {new Date(transaction.transaction_date).toLocaleDateString()}
      </div>

      {/* Ref No. */}
      <div className="col-span-1 text-xs truncate">
        {transaction.ref_no || '-'}
      </div>

      {/* Payee */}
      <div className="col-span-2 font-medium truncate">
        {transaction.payee || '-'}
      </div>

      {/* Memo */}
      <div className="col-span-2 text-xs text-gray-600 truncate">
        {transaction.memo || '-'}
      </div>

      {/* Charge */}
      <div className="col-span-1 text-right">
        {transaction.charge_usd ? (
          <span className="text-red-600">{formatCurrency(transaction.charge_usd)}</span>
        ) : '-'}
      </div>

      {/* Payment */}
      <div className="col-span-1 text-right">
        {transaction.payment_usd ? (
          <span className="text-green-600">{formatCurrency(transaction.payment_usd)}</span>
        ) : '-'}
      </div>

      {/* Account Type - editable (grouped by category) */}
      <div className="col-span-2">
        {isEditing ? (
          <Select value={editedAccountType} onValueChange={handleAccountTypeChange}>
            <SelectTrigger className="h-7 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(accountTypesByCategory).map(([category, types]) => (
                <div key={category}>
                  <div className="px-2 py-1.5 text-xs font-semibold text-gray-500 bg-gray-50">
                    {getDisplayName(category)}
                  </div>
                  {types.map((mapping) => (
                    <SelectItem key={mapping.accountType} value={mapping.accountType}>
                      {mapping.accountType}
                    </SelectItem>
                  ))}
                </div>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <div className="flex flex-col gap-0.5">
            <Badge variant="outline" className="text-xs font-medium">
              {transaction.account_type || 'Unclassified'}
            </Badge>
            <span className="text-[9px] text-gray-400">
              → {getDisplayName(transaction.category || 'unassigned')}
            </span>
          </div>
        )}
      </div>

      {/* Matched - editable checkbox */}
      <div className="col-span-1 text-center">
        {isEditing ? (
          <input
            type="checkbox"
            checked={editedIsMatched}
            onChange={(e) => setEditedIsMatched(e.target.checked)}
            className="h-4 w-4"
          />
        ) : (
          transaction.is_matched ? (
            <Badge className="bg-green-100 text-green-800 text-xs">✓</Badge>
          ) : (
            <Badge variant="outline" className="text-xs">-</Badge>
          )
        )}
      </div>

      {/* Notes - editable */}
      <div className="col-span-1">
        {isEditing ? (
          <div className="flex gap-1">
            <Input
              value={editedNotes}
              onChange={(e) => setEditedNotes(e.target.value)}
              placeholder="Notes"
              className="h-7 text-xs"
            />
            <Button size="sm" onClick={handleSave} className="h-7 px-2">
              <Save className="h-3 w-3" />
            </Button>
            <Button size="sm" variant="outline" onClick={handleCancel} className="h-7 px-2">
              <X className="h-3 w-3" />
            </Button>
          </div>
        ) : (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setIsEditing(true)}
            className="h-7 px-2 text-xs"
          >
            {transaction.notes ? transaction.notes.substring(0, 20) : 'Edit'}
          </Button>
        )}
      </div>
    </div>
  );
}
```

## Next Steps

1. Run the SQL to create the `ramp_transactions` table
2. Make all the frontend changes listed above
3. Build and test
4. Commit and push

## Notes

- Ramp tab works exactly like Bank Statements tab
- Inline editing for all key fields
- Upload accepts XLS/XLSX files
- Row 1 is skipped (title header)
- Row 2 contains column headers
- Data starts from row 3
- All Ramp Register columns are mapped to database

