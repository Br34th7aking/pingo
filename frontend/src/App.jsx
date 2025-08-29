import { Routes, Route } from "react-router";
import LoginPage from "./pages/LoginPage";
import ChatPage from "./pages/ChatPage";
import { AuthProvider } from "./contexts/AuthContext";
import { ChatProvider } from "./contexts/ChatContext";
import { ServerProvider } from "./contexts/ServerContext";
import { UIProvider } from "./contexts/UIContext";
export default function App() {
  return (
    <UIProvider>
      <AuthProvider>
        <ServerProvider>
          <ChatProvider>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/chat" element={<ChatPage />} />
            </Routes>
          </ChatProvider>
        </ServerProvider>
      </AuthProvider>
    </UIProvider>
  );
}
