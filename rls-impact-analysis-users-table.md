# RLS Impact Analysis: `users` Table

## 🎯 **Current State: UNRESTRICTED**
- Anyone with API access can read/write all user records
- No organization scoping on user queries
- Cross-tenant data leakage possible

---

## 📊 **Proposed Change: Enable RLS on `users` Table**

```sql
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Example policy (not implementing yet, just analyzing):
CREATE POLICY user_isolation ON users 
FOR ALL USING (
  auth_id = auth.uid() OR 
  EXISTS (
    SELECT 1 FROM organization_members om1, organization_members om2 
    WHERE om1.user_auth_id = auth.uid() 
    AND om2.user_auth_id = users.auth_id
    AND om1.organization_uuid = om2.organization_uuid
    AND om1.role IN ('admin', 'owner')
  )
);
```

---

## 🔍 **Impact Analysis by Layer**

### **1. 🗄️ Drizzle ORM Impact**

#### **✅ Positive Changes:**
- **Automatic Security**: All Drizzle queries will respect RLS policies
- **No Code Changes**: Existing queries continue to work, just with better security
- **Type Safety Maintained**: Drizzle schemas remain unchanged

#### **⚠️ Potential Issues:**
- **Admin Queries**: Super admin operations might need special handling
- **Background Jobs**: Service account queries might be blocked
- **Cross-org Features**: Organization analytics might break

#### **🔧 Code Impact Examples:**
```typescript
// This query would now be automatically scoped:
const users = await db.select().from(usersTable);
// Before: Returns ALL users
// After: Returns only users in same org OR users you can manage

// Admin operations might need service role:
const allUsers = await db.select().from(usersTable);
// Might return empty if current user isn't super admin
```

---

### **2. 🌐 API Layer Impact**

#### **✅ Positive Changes:**
- **Automatic Multi-tenancy**: APIs become org-scoped by default
- **Security by Default**: No accidental cross-org data exposure
- **Reduced Code Complexity**: Less manual filtering needed

#### **⚠️ Potential Breaking Changes:**

**Admin Endpoints:**
```typescript
// app/api/admin/users/route.ts
export async function GET() {
  // This might return empty for non-super-admins
  const users = await db.select().from(usersTable);
  return Response.json(users);
}
```

**User Search/Autocomplete:**
```typescript
// app/api/users/search/route.ts
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');
  
  // This would only search within accessible users
  const users = await db.select()
    .from(usersTable)
    .where(like(usersTable.name, `%${query}%`));
}
```

**Organization Management:**
```typescript
// app/api/organizations/[id]/users/route.ts
export async function GET({ params }) {
  // This might break if user can't see org users
  const orgUsers = await db.select()
    .from(usersTable)
    .innerJoin(organizationMembers, 
      eq(usersTable.authId, organizationMembers.userAuthId))
    .where(eq(organizationMembers.organizationUuid, params.id));
}
```

---

### **3. 🖥️ Frontend/UI Impact**

#### **✅ Positive Changes:**
- **Automatic Security**: User lists become org-scoped
- **Better UX**: Users only see relevant colleagues
- **Simplified Permissions**: Less complex permission checking

#### **⚠️ Potential UI Breaks:**

**User Management Pages:**
```typescript
// app/(dashboard)/admin/users/page.tsx
// This component might show empty state for non-admins
const UsersPage = async () => {
  const users = await getUsersList(); // Might return []
  
  if (users.length === 0) {
    return <div>No users found</div>; // Could be confusing
  }
};
```

**Autocomplete Components:**
```typescript
// components/UserSelect.tsx
const UserSelect = () => {
  const { data: users } = useSWR('/api/users', fetcher);
  // Might have fewer options than expected
  
  return (
    <Select>
      {users?.map(user => (
        <Option key={user.id} value={user.id}>{user.name}</Option>
      ))}
    </Select>
  );
};
```

**Organization Analytics:**
```typescript
// app/(dashboard)/analytics/users/page.tsx
// Cross-org analytics might break
const UserAnalytics = async () => {
  const allUsers = await getAllUsers(); // Might be limited
  const analytics = calculateUserMetrics(allUsers);
};
```

---

### **4. 🔐 Authentication & Authorization Impact**

#### **✅ Security Improvements:**
- **Data Isolation**: Users can't accidentally see other orgs' users
- **Principle of Least Privilege**: Access limited to necessary users
- **Audit Trail**: RLS policies provide clear access rules

#### **⚠️ Auth Flow Changes:**
- **Service Accounts**: Background jobs need special auth
- **Super Admin**: Might need bypass mechanism
- **Invitations**: Invitation flow might need adjustment

---

### **5. 📱 Ask BDI Algorithm Impact**

#### **✅ Positive for Ask BDI:**
- **Contextual Responses**: "Show me our team" becomes org-scoped
- **Security Compliance**: AI can't leak cross-org user data
- **Better Relevance**: User-related queries more focused

#### **⚠️ Potential Limitations:**
```typescript
// Ask BDI queries that might be affected:
"How many users do we have?" // Now org-scoped, not global
"Who are our most active users?" // Limited to accessible users
"Show me all admin users" // Might not see cross-org admins
```

---

## 🧪 **Testing Strategy**

### **Phase 1: Enable RLS (No Policies)**
```sql
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
-- Result: All queries return empty (safe test)
```

### **Phase 2: Add Permissive Policy**
```sql
CREATE POLICY users_own_data ON users FOR ALL USING (true);
-- Result: Back to current behavior, but RLS infrastructure ready
```

### **Phase 3: Implement Org Scoping**
```sql
DROP POLICY users_own_data ON users;
CREATE POLICY users_org_scoped ON users FOR ALL USING (
  -- User can see themselves
  auth_id = auth.uid() OR 
  -- User can see org colleagues if they're admin
  EXISTS (SELECT 1 FROM organization_members om1, organization_members om2 
          WHERE om1.user_auth_id = auth.uid() 
          AND om2.user_auth_id = users.auth_id
          AND om1.organization_uuid = om2.organization_uuid
          AND om1.role IN ('admin', 'owner'))
);
```

---

## 📋 **Recommendation**

**Start with Phase 1** to identify all breaking points without data exposure risk. This will show us exactly which APIs, components, and features depend on unrestricted user access.

**Expected Breakages:**
1. Admin user management pages
2. Cross-org analytics
3. User search/autocomplete
4. Background job user operations
5. Super admin functions

**Benefits:**
1. Automatic multi-tenancy
2. Improved security posture
3. Better Ask BDI contextual responses
4. Compliance readiness




