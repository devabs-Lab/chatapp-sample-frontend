import React, { useEffect, useState } from "react";
import classes from "./styling/dashboard.module.css";
import { Outlet, useLocation } from "react-router-dom";

function Dashboard() {

  const location = useLocation();
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);


  return (
    <div className={classes.dashboardLayout}>
      <main className={classes.mainContent}>
        <Outlet />
      </main>
    </div>
  );
}

export default Dashboard;
