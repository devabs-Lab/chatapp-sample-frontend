import React, { createContext, useContext, useEffect, useState } from "react";
import { io } from "socket.io-client";
export const SocketContext = createContext(null);
export const useSocket = () => useContext(SocketContext);
// import axiosbase from "./axiosconfig";
import { Appstate } from "./App";

const Socketprovider = ({ children }) => {
  const { user } = useContext(Appstate);
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    if (!user?.userid) return;

    const newSocket = io("http://localhost:5500", {
      query: { userId: user.userid }, // optional: join user-specific room
    });
    newSocket.on("connect", () => {
      console.log("Socket connected:", newSocket.id, "for user:", user.userid);
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [user?.userid]);

  return (
    <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>
  );
};

export default Socketprovider;
