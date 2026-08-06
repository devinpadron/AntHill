import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { ThemeProvider } from "./theme/ThemeProvider";
import { AuthProvider } from "./contexts/AuthContext";
import { CompanyGuard } from "./routing/CompanyGuard";
import { ErrorBoundary } from "./routing/ErrorBoundary";
import { AlertHost, ToastBridge, ToastProvider } from "./ui";
import { UploadProvider } from "./contexts/UploadContext";
import { LoginPage } from "./pages/LoginPage";
import {
	ForbiddenPage,
	NoAccessPage,
	NotFoundPage,
	RootRedirect,
	SelectCompanyPage,
} from "./pages/StatusPages";
import { DiagnosticsPage } from "./pages/DiagnosticsPage";
import { EmployeesPage } from "./pages/people/EmployeesPage";
import { GroupsPage } from "./pages/people/GroupsPage";
import { CalendarPage } from "./pages/calendar/CalendarPage";
import { EventDrawer } from "./pages/calendar/EventDrawer";
import { EventEditorPage } from "./pages/calendar/EventEditorPage";
import { PayrollPage } from "./pages/payroll/PayrollPage";
import { TimeEntryDetailPage } from "./pages/payroll/TimeEntryDetailPage";
import { StaffingBoardPage } from "./pages/availability/StaffingBoardPage";
import { SettingsLayout } from "./pages/settings/SettingsLayout";
import { CompanySettingsPage } from "./pages/settings/CompanySettingsPage";
import { FormEditorPage } from "./pages/settings/FormEditorPage";
import {
	ChecklistsPage,
	PackagesPage,
	LabelsPage,
} from "./pages/settings/LibraryPages";
import "./styles/global.css";

/*
 * Provider order matters:
 *
 *   ThemeProvider   emits the CSS custom properties everything else styles with
 *   ToastProvider   must wrap AlertHost — informational alerts downgrade to toasts
 *   AuthProvider    resolves the session before any route decides where to go
 *   BrowserRouter   inside auth, because the redirect target depends on it
 *
 * AlertHost and ToastBridge sit at the root rather than inside the shell, so a
 * dialog raised from the login page or a 403 still renders.
 */

export function App() {
	return (
		<ThemeProvider>
			<ToastProvider>
				<ToastBridge />
				<AlertHost />
				<AuthProvider>
					<UploadProvider>
						<BrowserRouter>
							<ErrorBoundary>
								<Routes>
									<Route
										path="/"
										element={<RootRedirect />}
									/>
									<Route
										path="/login"
										element={<LoginPage />}
									/>
									<Route
										path="/select-company"
										element={<SelectCompanyPage />}
									/>
									<Route
										path="/no-access"
										element={<NoAccessPage />}
									/>
									<Route
										path="/403"
										element={<ForbiddenPage />}
									/>

									{/*
									 * Everything company-scoped. CompanyGuard
									 * checks membership and role, then renders
									 * CompanyProvider + AppShell around the outlet.
									 */}
									<Route
										path="/:companyId"
										element={<CompanyGuard />}
									>
										<Route
											index
											element={
												<Navigate
													to="calendar"
													replace
												/>
											}
										/>

										{/*
										 * The drawer is a CHILD route, so the
										 * calendar stays mounted and its
										 * subscriptions stay live behind it —
										 * closing the drawer is instant, with no
										 * refetch of the month.
										 */}
										<Route
											path="calendar"
											element={<CalendarPage />}
										>
											<Route
												path="events/:eventId"
												element={<EventDrawer />}
											/>
										</Route>
										<Route
											path="events/new"
											element={<EventEditorPage />}
										/>
										<Route
											path="events/:eventId/edit"
											element={<EventEditorPage />}
										/>
										<Route
											path="availability"
											element={<StaffingBoardPage />}
										/>
										<Route
											path="payroll"
											element={<PayrollPage />}
										/>
										<Route
											path="payroll/entries/:entryId"
											element={<TimeEntryDetailPage />}
										/>
										<Route
											path="employees"
											element={<EmployeesPage />}
										/>
										<Route
											path="groups"
											element={<GroupsPage />}
										/>
										<Route
											path="settings"
											element={<SettingsLayout />}
										>
											<Route
												index
												element={
													<CompanySettingsPage />
												}
											/>
											<Route
												path="forms/:kind"
												element={<FormEditorPage />}
											/>
											<Route
												path="checklists"
												element={<ChecklistsPage />}
											/>
											<Route
												path="packages"
												element={<PackagesPage />}
											/>
											<Route
												path="labels"
												element={<LabelsPage />}
											/>
										</Route>

										<Route
											path="diagnostics"
											element={<DiagnosticsPage />}
										/>
										<Route
											path="*"
											element={<NotFoundPage />}
										/>
									</Route>

									<Route
										path="*"
										element={<NotFoundPage />}
									/>
								</Routes>
							</ErrorBoundary>
						</BrowserRouter>
					</UploadProvider>
				</AuthProvider>
			</ToastProvider>
		</ThemeProvider>
	);
}
