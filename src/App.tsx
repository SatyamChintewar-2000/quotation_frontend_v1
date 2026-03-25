import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProductProvider } from "@/contexts/ProductContext";
import { QuotationProvider } from "@/contexts/QuotationContext";
import { InvoiceProvider } from "@/contexts/InvoiceContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { MainLayout } from "@/components/layout/MainLayout";
import { queryClient } from "@/lib/queryClient";

import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import ProductManagement from "@/pages/ProductManagement";
import CustomerManagement from "@/pages/CustomerManagement";
import NewQuotation from "@/pages/NewQuotation";
import QuotationHistory from "@/pages/QuotationHistory";
import InvoiceManagement from "@/pages/InvoiceManagement";
import NewInvoice from "@/pages/NewInvoice";
import InvoiceDetails from "@/pages/InvoiceDetails";
import MasterSettings from "@/pages/MasterSettings";
import CompanyMaster from "@/pages/CompanyMaster";
import SmsTemplate from "@/pages/SmsTemplate";
import Reports from "@/pages/Reports";
import UserManagement from "@/pages/UserManagement";
import ColorTheme from "@/pages/ColorTheme";
import NotFound from "@/pages/NotFound";

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
    <AuthProvider>
      <ProductProvider>
        <QuotationProvider>
          <InvoiceProvider>
            <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                
                <Route
                  element={
                    <ProtectedRoute>
                      <MainLayout />
                    </ProtectedRoute>
                  }
                >
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route
                    path="/master-settings"
                    element={
                      <ProtectedRoute requiredPermission="master_settings">
                        <MasterSettings />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/company-master"
                    element={
                      <ProtectedRoute requiredPermission="company_master">
                        <CompanyMaster />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/sms-template"
                    element={
                      <ProtectedRoute requiredPermission="sms_template">
                        <SmsTemplate />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/add-product"
                    element={
                      <ProtectedRoute requiredPermission="add_product">
                        <ProductManagement />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/client-details"
                    element={
                      <ProtectedRoute requiredPermission="client_details">
                        <CustomerManagement />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/new-quotation"
                    element={
                      <ProtectedRoute requiredPermission="new_quotation">
                        <NewQuotation />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/quotation-history"
                    element={
                      <ProtectedRoute requiredPermission="quotation_history">
                        <QuotationHistory />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/invoices"
                    element={
                      <ProtectedRoute requiredPermission="invoice_management">
                        <InvoiceManagement />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/new-invoice"
                    element={
                      <ProtectedRoute requiredPermission="new_invoice">
                        <NewInvoice />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/invoice/:id"
                    element={
                      <ProtectedRoute requiredPermission="invoice_management">
                        <InvoiceDetails />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/reports"
                    element={
                      <ProtectedRoute requiredPermission="reports">
                        <Reports />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/user-management"
                    element={
                      <ProtectedRoute requiredPermission="user_management">
                        <UserManagement />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/color-theme"
                    element={
                      <ProtectedRoute requiredPermission="color_theme">
                        <ColorTheme />
                      </ProtectedRoute>
                    }
                  />
                </Route>

                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </TooltipProvider>
          </InvoiceProvider>
        </QuotationProvider>
      </ProductProvider>
    </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
