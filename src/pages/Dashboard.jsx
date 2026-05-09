import React, { useEffect, useState } from "react";
import classes from "./styling/dashboard.module.css";
import Header from "./Header";
import Footer from "./Footer";

import { Outlet, useLocation } from "react-router-dom";
function Dashboard() {
  const [showMobileFooter, setShowMobileFooter] = useState(false);

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

  const shouldHideFooter =
    isMobile && location.pathname === "/chat" && !showMobileFooter;

  return (
    <>
      <div className={classes.dashboardLayout}>
        <Header />
        <main className={classes.mainContent}>
          <Outlet context={{ setShowMobileFooter }} />
        </main>
        {!shouldHideFooter && <Footer />}
      </div>
    </>
  );
}

export default Dashboard;
