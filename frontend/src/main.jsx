import { createRoot } from "react-dom/client";
import "./index.css";
import { AuthProvider } from "./authContext.jsx";
import ProjectRoutes from "./Routes.jsx";
import { BrowserRouter as Router } from "react-router-dom";
import { ConfirmProvider } from "./components/common/ConfirmContext.jsx";

createRoot(document.getElementById("root")).render(
  <AuthProvider>
    <Router>
      <ConfirmProvider>
        <ProjectRoutes />
      </ConfirmProvider>
    </Router>
  </AuthProvider>,
);
