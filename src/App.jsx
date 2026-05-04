import Registers from "./pages/Registers";
import { Route, Routes, useNavigate } from "react-router-dom";
import "./App.css";
import { useState, useEffect, createContext } from "react";
import Socketprovider from "./Socketprovider";
import SocketWrapper from "./SocketWrapper";
import axiosbase from "./axiosconfig";
import Dashboard from "./pages/Dashboard";
import { getOrCreateDeviceKey } from "./db/keyManager.js";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";
import Chat from "./pages/Chat";

export const Appstate = createContext();
export const CryptoContext = createContext();

function App() {
  const [user, setuser] = useState({});

  // Crypto key for this user (derived from user.userid)
  const [cryptoKey, setCryptoKey] = useState(null);

  const navigate = useNavigate();
  const token = sessionStorage.getItem("token");
  if (token) {
    axiosbase.defaults.headers.common["Authorization"] = `Bearer ${token}`;
  }
  async function check() {
    try {
      const { data } = await axiosbase.get("/users/check");
      console.log(data);
      setuser(data);
    } catch (error) {
      console.log(error?.response);
      navigate("/login");
    }
  }

  useEffect(() => {
    check();
  }, []);

  useEffect(() => {
    if (!user.userid) return;
    let mounted = true;
    const loadDeviceKey = async () => {
      try {
        const key = await getOrCreateDeviceKey(user.userid); // persistent per-device AES key
        if (mounted) setCryptoKey(key);
      } catch (err) {
        console.error("Error loading device key:", err);
      }
    };
    loadDeviceKey();
    return () => {
      mounted = false;
    };
  }, [user?.userid]);

  return (
    <Appstate.Provider value={{ user, setuser }}>
      <CryptoContext.Provider value={{ cryptoKey }}>
        <Socketprovider>
          <SocketWrapper>
            {({
              offset,
              setoffset,
              messages,
              setMessages,
              messagesCache,
              setMessagesCache,
              unreadCount,
              setUnreadCount,
              selectedConversation,
              setSelectedConversation,
              sendFileToServer,
              atBottomRef,
              pendingAutoScrollRef,
              hydratedChatsRef,
              pendingMessagesRef,
              activeUploadsRef,
              updateCache,
              resendPendingMessage,
            }) => (
              <Routes>
                <Route path="/" element={<Dashboard />}>
                  {/* <Route index element={<Navigate to="/home" />} /> */}

                  <Route path="login" element={<Registers />} />
                  <Route path="signup" element={<Registers />} />

                  <Route
                    path="chat"
                    element={
                      <Chat
                        selectedConversation={selectedConversation}
                        setSelectedConversation={setSelectedConversation}
                        setMessagesCache={setMessagesCache}
                        messagesCache={messagesCache}
                        unreadCount={unreadCount}
                        setMessages={setMessages}
                        messages={messages}
                        setUnreadCount={setUnreadCount}
                        pendingAutoScrollRef={pendingAutoScrollRef}
                        hydratedChatsRef={hydratedChatsRef}
                        atBottomRef={atBottomRef}
                        updateCache={updateCache}
                        offset={offset}
                        setoffset={setoffset}
                        resendPendingMessage={resendPendingMessage}
                        pendingMessagesRef={pendingMessagesRef}
                        activeUploadsRef={activeUploadsRef}
                        sendFileToServer={sendFileToServer}
                      />
                    }
                  />
                  <Route path="privacy" element={<Privacy />} />
                  <Route path="terms" element={<Terms />} />
                </Route>
              </Routes>
            )}
          </SocketWrapper>
        </Socketprovider>
      </CryptoContext.Provider>
    </Appstate.Provider>
  );
}

export default App;
