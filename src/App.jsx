import Registers from "./pages/Registers";
import { Route, Routes, useNavigate } from "react-router-dom";
import "./App.css";
import { useState, useEffect, createContext } from "react";
import Socketprovider from "./Socketprovider";
import { ChatProvider } from "./context/ChatContext";
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
  // const [loading, setLoading] = useState(true);
  // Crypto key for this user (derived from user.userid)
  const [cryptoKey, setCryptoKey] = useState(null);

  const navigate = useNavigate();

  const token = sessionStorage.getItem("token");

  if (token) {
    axiosbase.defaults.headers.common["Authorization"] = `Bearer ${token}`;
  } else {
    delete axiosbase.defaults.headers.common["Authorization"];
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

  // useEffect(() => {
  //   if (!user.userid) return;
  //   let mounted = true;
  //   const loadDeviceKey = async () => {
  //     try {
  //       const key = await getOrCreateDeviceKey(user.userid); // persistent per-device AES key
  //       if (mounted) setCryptoKey(key);
  //     } catch (err) {
  //       console.error("Error loading device key:", err);
  //     }
  //   };
  //   loadDeviceKey();
  //   return () => {
  //     mounted = false;
  //   };
  // }, [user?.userid]);

  // if (loading) {
  //   return (
  //     <div className={"chatLoading"}>
  //       <div className={"loadingSpinner"}></div>
  //       <p>Loading messages...</p>
  //     </div>
  //   );
  // }
  return (
    <Appstate.Provider value={{ user, setuser }}>
      <CryptoContext.Provider value={{ cryptoKey }}>
        <Socketprovider>
          <ChatProvider>
            <Routes>
              <Route path="/" element={<Dashboard />}>
                <Route path="login" element={<Registers />} />
                <Route path="signup" element={<Registers />} />
                <Route path="chat" element={<Chat />} />
                <Route path="privacy" element={<Privacy />} />
                <Route path="terms" element={<Terms />} />
              </Route>
            </Routes>
          </ChatProvider>
        </Socketprovider>
      </CryptoContext.Provider>
    </Appstate.Provider>
  );
}

export default App;
