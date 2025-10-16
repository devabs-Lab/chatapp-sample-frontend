import classes from "./styling/footer.module.css";

import instagram from "../assets/instagram.png";
import facebook from "../assets/facebook.png";
import logo from "../assets/logo-uop.png";
import linkedin from "../assets/linkedin.png";

import { Link } from "react-router-dom";

function Footer() {
  return (
    <>
      <footer className={classes.footer}>
        <div className={classes.footer_content}>
          <div className={classes.footer_logo}>
            <span className={classes.logo_text}>
              <img src={logo} alt="UoPeople logo" />
            </span>
            <div className={classes.social_links}>
              <Link
                to="https://web.facebook.com/UoPeople?_rdc=1&_rdr#"
                target="_blank"
                rel="noopener noreferrer"
              >
                <img src={instagram} alt="" />
              </Link>
              <Link
                to="https://www.facebook.com/UoPeople?_rdc=1&_rdr#"
                target="_blank"
                rel="noopener noreferrer"
              >
                <img src={facebook} alt="" />
              </Link>
              <Link
                to="https://www.linkedin.com/school/university-of-the-people/"
                target="_blank"
                rel="noopener noreferrer"
              >
                <img src={linkedin} alt="" />
              </Link>
            </div>
          </div>

          <div className={classes.footer_links}>
            <h4>Useful Link</h4>
            <ul>
              <li>
                <Link to="/privacy">Privacy policy</Link>
              </li>
              <li>
                <Link to="/terms">Terms of Service</Link>
              </li>
              <li>
                <Link
                  to="https://www.uopeople.edu/about/"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  About UoPeople
                </Link>
              </li>
            </ul>
          </div>

          <div className={classes.contact_info}>
            <h4>UoPeople Contact Info</h4>
            <ul>
              <li>
                <Link
                  to="https://www.uopeople.edu"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  University of People
                </Link>
              </li>
              <li>
                <Link>advising@uopeople.edu</Link>
              </li>
              <li>
                <Link>+1 (626) 264-8880</Link>
              </li>
            </ul>
          </div>
        </div>
      </footer>
    </>
  );
}

export default Footer;
