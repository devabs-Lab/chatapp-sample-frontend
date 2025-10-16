import classes from "./styling/header.module.css";
import { useContext } from "react";
import { Link, useNavigate } from "react-router-dom";
import { showSuccessAlert } from "../components/alerthelper";
import { Appstate } from "../App";
import axiosbase from "../axiosconfig";
function Header() {
  const { setuser } = useContext(Appstate);
  const navigate = useNavigate();
  const token = sessionStorage.getItem("token");

  const handleLogout = () => {
    showSuccessAlert("LogOut Successful", "Click OK to continue", () => {
      sessionStorage.removeItem("token");
      delete axiosbase.defaults.headers.common["Authorization"];
      // also reset any React state that stores user info
      setuser({});

      navigate("/login");
    });
  };
  return (
    <>
      <header className={classes.header}>
        <div className={classes.nav_container}>
          <div className={classes.logo}>
            <span className={classes.logo_text}>
              <img
                src="https://www.uopeople.edu/wp-content/uploads/2022/05/logo-uop.webp"
                alt="UoPeople logo"
              />
            </span>
          </div>
          <nav className={classes.nav_links}>
            {/* <Link to="/chat">Home</Link> */}

            <span to="">How it Works</span>
            {!token ? (
              <Link to="/login">
                <button className={classes.signin_btn}>SIGN IN</button>
              </Link>
            ) : (
              <button onClick={handleLogout} className={classes.signin_btn}>
                SIGN OUT
              </button>
            )}
          </nav>
        </div>
      </header>
    </>
  );
}

export default Header;
