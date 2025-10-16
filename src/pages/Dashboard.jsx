import React from "react";
import classes from "./styling/dashboard.module.css";
import Header from "./Header";
import Footer from "./Footer";

import { Outlet } from "react-router-dom";
function Dashboard() {
  return (
    <>
      <div className={classes.dashboardLayout}>
        <Header />
        <main className={classes.mainContent}>
          <Outlet />
        </main>
        <Footer />
      </div>
    </>
  );
}

export default Dashboard;
