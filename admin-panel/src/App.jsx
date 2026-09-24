import React from "react";
import {
  BrowserRouter as Router,
  Navigate,
  Route,
  Routes,
} from "react-router-dom";
import AdminRedesignLayout from "./components/AdminRedesignLayout";
import RedesignPageFrame from "./components/RedesignPageFrame";
import HomeRedesign from "./screens/HomeRedesign";
import UserList from "./screens/users/Screens/UserListRedesign";
import LeadsList from "./screens/leads/Screens/LeadsListRedesign";
import LeadDetailScreen from "./screens/leads/Screens/leadsdetailsscreen";
import LeadEditScreen from "./screens/leads/Screens/leadEdit";
import BranchesScreen from "./screens/branches/BranchesRedesign";
import AttendanceScreen from "./screens/attendance/AttendanceRedesign";
import UserDetailScreen from "./screens/users/Screens/UserDetailRedesign";
import TaskScreen from "./screens/tasks/Screens/TaskScreenRedesign";
import TemplateScreen from "./screens/template/TemplateScreenRedesign";
import Login from "./screens/login/LoginRedesign";
import ProtectedRoute from "./protectedRoute";
import PerformanceScreen from "./screens/performance/PerformanceRedesign";
import LeadsReport from "./screens/leadReport/LeadReportRedesign";
import LeadStatusesScreen from "./screens/leadStatuses/LeadStatusesRedesign";
import LoanProductsScreen from "./screens/loanProducts/LoanProductsRedesign";
import LeadSourcesScreen from "./screens/leadSources/LeadSourcesRedesign";
import DocumentTypesScreen from "./screens/documentTypes/DocumentTypesRedesign";
import LendersScreen from "./screens/lenders/LendersRedesign";
import OperationsScreen from "./screens/operations/OperationsRedesign";
import SettingsScreen from "./screens/settings/settings";
import CompanyProfileScreen from "./screens/company/CompanyProfileScreen";
import BankerPortalScreen from "./screens/banker/BankerPortalScreen";
import BankerQueriesScreen from "./screens/banker/BankerQueriesScreen";
import PlatformOverview from "./screens/platform/PlatformOverview";
import CompaniesScreen from "./screens/platform/CompaniesScreen";
import CompanyDetailScreen from "./screens/platform/CompanyDetailScreen";
import PlansScreen from "./screens/platform/PlansScreen";
import PartyPayoutsScreen from "./screens/partyPayouts/PartyPayoutsScreen";
import CasePayoutsScreen from "./screens/payouts/CasePayoutsScreen";
import ExpenseTrackerScreen from "./screens/expenses/ExpenseTrackerScreen";

const PageShell = ({ children, allowedRoles = ["manager"] }) => (
  <ProtectedRoute allowedRoles={allowedRoles}>
    <AdminRedesignLayout>{children}</AdminRedesignLayout>
  </ProtectedRoute>
);

// The platform console brings its own shell, so it is guarded but not wrapped
// in the company layout.
const PlatformShell = ({ children }) => (
  <ProtectedRoute allowedRoles={["superadmin"]}>{children}</ProtectedRoute>
);

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/platform"
          element={
            <PlatformShell>
              <PlatformOverview />
            </PlatformShell>
          }
        />
        <Route
          path="/platform/companies"
          element={
            <PlatformShell>
              <CompaniesScreen />
            </PlatformShell>
          }
        />
        <Route
          path="/platform/companies/:id"
          element={
            <PlatformShell>
              <CompanyDetailScreen />
            </PlatformShell>
          }
        />
        <Route
          path="/platform/plans"
          element={
            <PlatformShell>
              <PlansScreen />
            </PlatformShell>
          }
        />
        <Route
          path="/"
          element={
            <PageShell>
              <HomeRedesign />
            </PageShell>
          }
        />
        <Route
          path="/leads"
          element={
            <PageShell>
              <LeadsList />
            </PageShell>
          }
        />
        <Route
          path="/add-users"
          element={
            <PageShell>
              <UserList />
            </PageShell>
          }
        />
        <Route
          path="/branches"
          element={
            <PageShell>
              <BranchesScreen />
            </PageShell>
          }
        />
        <Route
          path="/lead-details/:id"
          element={
            <PageShell allowedRoles={["manager", "operations"]}>
              <RedesignPageFrame pageKey="lead-details">
                <LeadDetailScreen />
              </RedesignPageFrame>
            </PageShell>
          }
        />
        <Route
          path="/lead-edit/:id"
          element={
            <PageShell allowedRoles={["manager", "operations"]}>
              <RedesignPageFrame pageKey="lead-edit">
                <LeadEditScreen />
              </RedesignPageFrame>
            </PageShell>
          }
        />
        <Route
          path="/attendance"
          element={
            <PageShell>
              <AttendanceScreen />
            </PageShell>
          }
        />
        <Route
          path="/userdetail/:emp_id"
          element={
            <PageShell>
              <UserDetailScreen />
            </PageShell>
          }
        />
        <Route
          path="/tasks"
          element={
            <PageShell>
              <TaskScreen />
            </PageShell>
          }
        />
        <Route
          path="/template"
          element={
            <PageShell>
              <TemplateScreen />
            </PageShell>
          }
        />
        <Route
          path="/lenders"
          element={
            <PageShell>
              <LendersScreen />
            </PageShell>
          }
        />
        <Route
          path="/lead-statuses"
          element={
            <PageShell>
              <LeadStatusesScreen />
            </PageShell>
          }
        />
        <Route
          path="/loan-products"
          element={
            <PageShell>
              <LoanProductsScreen />
            </PageShell>
          }
        />
        <Route
          path="/lead-sources"
          element={
            <PageShell>
              <LeadSourcesScreen />
            </PageShell>
          }
        />
        <Route
          path="/party-payouts"
          element={
            <PageShell allowedRoles={["manager", "operations"]}>
              <PartyPayoutsScreen />
            </PageShell>
          }
        />
        <Route
          path="/case-payouts"
          element={
            <PageShell allowedRoles={["manager", "operations"]}>
              <CasePayoutsScreen />
            </PageShell>
          }
        />
        <Route
          path="/payouts"
          element={
            <PageShell allowedRoles={["manager", "operations"]}>
              <CasePayoutsScreen />
            </PageShell>
          }
        />
        <Route
          path="/expenses"
          element={
            <PageShell allowedRoles={["manager", "operations"]}>
              <ExpenseTrackerScreen />
            </PageShell>
          }
        />
        <Route
          path="/expense-tracker"
          element={
            <PageShell allowedRoles={["manager", "operations"]}>
              <ExpenseTrackerScreen />
            </PageShell>
          }
        />
        <Route
          path="/document-types"
          element={
            <PageShell>
              <DocumentTypesScreen />
            </PageShell>
          }
        />
        <Route
          path="/operations"
          element={
            <PageShell allowedRoles={["manager", "operations"]}>
              <OperationsScreen />
            </PageShell>
          }
        />
        <Route
          path="/performance"
          element={
            <PageShell>
              <PerformanceScreen />
            </PageShell>
          }
        />
        <Route
          path="/lead_report"
          element={
            <PageShell>
              <LeadsReport />
            </PageShell>
          }
        />
        <Route
          path="/settings"
          element={
            <PageShell>
              <RedesignPageFrame pageKey="settings">
                <SettingsScreen />
              </RedesignPageFrame>
            </PageShell>
          }
        />
        <Route
          path="/company"
          element={
            <PageShell allowedRoles={["manager", "operations", "banker"]}>
              <CompanyProfileScreen />
            </PageShell>
          }
        />
        <Route
          path="/banker"
          element={
            <PageShell allowedRoles={["manager", "operations", "banker"]}>
              <BankerPortalScreen />
            </PageShell>
          }
        />
        <Route
          path="/banker/queries"
          element={
            <PageShell allowedRoles={["manager", "operations", "banker"]}>
              <BankerQueriesScreen />
            </PageShell>
          }
        />
        <Route path="*" element={<Navigate to="/login" />} />
      </Routes>
    </Router>
  );
}

export default App;

