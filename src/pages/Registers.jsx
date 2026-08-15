import { useState, useContext } from "react";
import axiosbase from "../axiosconfig";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Appstate } from "../App";
import classes from "./styling/register.module.css";
import { showErrorAlert, showSuccessAlert } from "../components/alerthelper";
import { FaEye, FaEyeSlash } from "react-icons/fa";

function Registers() {
  const { setuser } = useContext(Appstate);
  const navigate = useNavigate();
  const location = useLocation();
  const isLogin = location.pathname === "/login";

  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [toperror, setToperr] = useState("");
  const [toperrors, setToperrs] = useState("");
  const [isAgreed, setIsAgreed] = useState(false);
  const [touched, setTouched] = useState({
    password: false,
    userName: false,
    firstName: false,
    lastName: false,
  });

  const [formData, setFormData] = useState({
    email: "",
    firstName: "",
    lastName: "",
    userName: "",
    password: "",
  });

  const [signData, setsignData] = useState({ email: "", password: "" });

  /* ============ Validation ============ */
  const validateName = (name) => /^[A-Za-z]{3,}$/.test(name);
  const validateUsername = (username) =>
    username.replace(/[^A-Za-z]/g, "").length + username.replace(/[A-Za-z]/g, "").length ===
      username.length && username.length >= 5;
  const validatePassword = (password) => {
    const u = /[A-Z]/g, l = /[a-z]/g, n = /[0-9]/g, s = /[@$^&*!#%]/g;
    return (
      (password.match(u) || []).length >= 2 &&
      (password.match(l) || []).length >= 2 &&
      (password.match(n) || []).length >= 1 &&
      (password.match(s) || []).length >= 1 &&
      password.length >= 8
    );
  };

  const validateField = (name, value) => {
    const newErrors = { ...errors };
    if (name === "userName") {
      if (!validateUsername(value)) newErrors[name] = "Username must be at least 5 characters.";
      else delete newErrors[name];
    }
    if (name === "password") {
      if (!validatePassword(value))
        newErrors[name] = "Password: 2 uppercase, 2 lowercase, 1 number, 1 special character.";
      else delete newErrors[name];
    }
    if (name === "firstName") {
      if (!validateName(value)) newErrors[name] = "First name must be 3+ letters only.";
      else delete newErrors[name];
    }
    if (name === "lastName") {
      if (!validateName(value)) newErrors[name] = "Last name must be 3+ letters only.";
      else delete newErrors[name];
    }
    setErrors(newErrors);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (touched[name] && value.trim() !== "") validateField(name, value);
  };

  const handleBlur = (e) => {
    const { name, value } = e.target;
    setTouched((prev) => ({ ...prev, [name]: true }));
    if (value.trim() !== "") validateField(name, value);
  };

  /* ============ Sign Up ============ */
  async function handleSubmit(e) {
    e.preventDefault();
    setToperr("");
    const currentErrors = {};
    if (!validateName(formData.firstName)) currentErrors.firstName = "First name must be 3+ letters only.";
    if (!validateName(formData.lastName)) currentErrors.lastName = "Last name must be 3+ letters only.";
    if (!validateUsername(formData.userName)) currentErrors.userName = "Username must be at least 5 characters.";
    if (!validatePassword(formData.password))
      currentErrors.password = "Password: 2 uppercase, 2 lowercase, 1 number, 1 special char.";
    if (Object.keys(currentErrors).length > 0) { setErrors(currentErrors); return; }

    try {
      await axiosbase.post("/users/register", {
        username: formData.userName,
        firstname: formData.firstName,
        lastname: formData.lastName,
        email: formData.email,
        password: formData.password,
      });
      navigate("/login");
      setFormData({ email: "", firstName: "", lastName: "", userName: "", password: "" });
    } catch (error) {
      setToperr(error?.response?.data?.msg);
      showErrorAlert("Sign Up Failed", error?.response?.data?.msg);
    }
  }

  /* ============ Sign In ============ */
  const handleChangefors = (e) => {
    const { name, value } = e.target;
    setsignData({ ...signData, [name]: value });
  };

  async function handleSubmitfors(e) {
    e.preventDefault();
    setToperrs("");
    try {
      const res = await axiosbase.post("/users/login", {
        email: signData.email,
        password: signData.password,
      });
      if (res.status === 200) {
        showSuccessAlert("Login Successful", "Welcome back!", () => {
          setuser(res?.data);
          sessionStorage.setItem("token", res?.data?.token);
          navigate("/chat");
        });
      }
    } catch (error) {
      setToperrs(error?.response?.data?.msg);
      showErrorAlert("Login Failed", error?.response?.data?.msg || "Something went wrong");
    }
  }

  return (
    <div className={classes.authPage}>
      {/* === LEFT BRAND PANEL === */}
      <div className={classes.brandPanel}>
        <div className={classes.brandLogo}>
          <div className={classes.brandLogoBox}>U</div>
          <div>
            <div className={classes.brandLogoText}>UoPeople Chat</div>
            <div className={classes.brandLogoSub}>Student Portal</div>
          </div>
        </div>

        <div className={classes.brandContent}>
          <p className={classes.brandTagline}>Collaborative Learning</p>
          <h1 className={classes.brandHeadline}>
            Connect with <span>students</span><br />around the world
          </h1>
          <p className={classes.brandDescription}>
            The official discussion space for UoPeople students. Share knowledge,
            collaborate on courses, and support each other — no matter where you are.
          </p>
        </div>

        <div className={classes.brandFooterStats}>
          <div className={classes.stat}>
            <span className={classes.statNumber}>120K+</span>
            <span className={classes.statLabel}>Students</span>
          </div>
          <div className={classes.stat}>
            <span className={classes.statNumber}>50+</span>
            <span className={classes.statLabel}>Countries</span>
          </div>
          <div className={classes.stat}>
            <span className={classes.statNumber}>100%</span>
            <span className={classes.statLabel}>Online</span>
          </div>
        </div>
      </div>

      {/* === RIGHT FORM PANEL === */}
      <div className={classes.formPanel}>
        {isLogin ? (
          <>
            <div className={classes.formHeader}>
              <h2 className={classes.formTitle}>Welcome back 👋</h2>
              <p className={classes.formSubtitle}>
                Don't have an account?{" "}
                <Link to="/signup" className={classes.formLink}>
                  Create one
                </Link>
              </p>
            </div>

            <form onSubmit={handleSubmitfors} className={classes.form}>
              {toperrors && <div className={classes.topErrorBox}>{toperrors}</div>}

              <div className={classes.fieldGroup}>
                <label className={classes.fieldLabel}>Email address</label>
                <input
                  type="email"
                  name="email"
                  placeholder="you@uopeople.edu"
                  value={signData.email}
                  onChange={handleChangefors}
                  className={classes.fieldInput}
                  required
                />
              </div>

              <div className={classes.fieldGroup}>
                <label className={classes.fieldLabel}>Password</label>
                <div className={classes.passwordWrapper}>
                  <input
                    type={showPassword ? "text" : "password"}
                    name="password"
                    placeholder="Enter your password"
                    value={signData.password}
                    onChange={handleChangefors}
                    className={classes.fieldInput}
                    required
                  />
                  <span
                    className={classes.eyeIcon}
                    onClick={() => setShowPassword((p) => !p)}
                  >
                    {showPassword ? <FaEye /> : <FaEyeSlash />}
                  </span>
                </div>
              </div>

              <Link to="" className={classes.forgotLink}>
                Forgot password?
              </Link>

              <button type="submit" className={classes.submitBtn}>
                Sign In
              </button>
            </form>
          </>
        ) : (
          <>
            <div className={classes.formHeader}>
              <h2 className={classes.formTitle}>Join UoPeople Chat</h2>
              <p className={classes.formSubtitle}>
                Already have an account?{" "}
                <Link to="/login" className={classes.formLink}>
                  Sign in
                </Link>
              </p>
            </div>

            <form onSubmit={handleSubmit} className={classes.form}>
              {toperror && <div className={classes.topErrorBox}>{toperror}</div>}

              <div className={classes.fieldGroup}>
                <label className={classes.fieldLabel}>Email address</label>
                <input
                  type="email"
                  name="email"
                  placeholder="you@uopeople.edu"
                  value={formData.email}
                  onChange={handleChange}
                  className={classes.fieldInput}
                  required
                />
              </div>

              <div className={classes.nameRow}>
                <div className={classes.fieldGroup}>
                  <label className={classes.fieldLabel}>First name</label>
                  <input
                    type="text"
                    name="firstName"
                    placeholder="John"
                    value={formData.firstName}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    className={`${classes.fieldInput} ${touched.firstName && errors.firstName ? classes.fieldError : ""}`}
                    required
                  />
                  {touched.firstName && errors.firstName && (
                    <span className={classes.errorText}>{errors.firstName}</span>
                  )}
                </div>
                <div className={classes.fieldGroup}>
                  <label className={classes.fieldLabel}>Last name</label>
                  <input
                    type="text"
                    name="lastName"
                    placeholder="Doe"
                    value={formData.lastName}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    className={`${classes.fieldInput} ${touched.lastName && errors.lastName ? classes.fieldError : ""}`}
                    required
                  />
                  {touched.lastName && errors.lastName && (
                    <span className={classes.errorText}>{errors.lastName}</span>
                  )}
                </div>
              </div>

              <div className={classes.fieldGroup}>
                <label className={classes.fieldLabel}>Username</label>
                <input
                  type="text"
                  name="userName"
                  placeholder="johndoe123"
                  value={formData.userName}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  className={`${classes.fieldInput} ${touched.userName && errors.userName ? classes.fieldError : ""}`}
                  required
                />
                {touched.userName && errors.userName && (
                  <span className={classes.errorText}>{errors.userName}</span>
                )}
              </div>

              <div className={classes.fieldGroup}>
                <label className={classes.fieldLabel}>Password</label>
                <div className={classes.passwordWrapper}>
                  <input
                    type={showPassword ? "text" : "password"}
                    name="password"
                    placeholder="Create a strong password"
                    value={formData.password}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    className={`${classes.fieldInput} ${touched.password && errors.password ? classes.fieldError : ""}`}
                    required
                  />
                  <span
                    className={classes.eyeIcon}
                    onClick={() => setShowPassword((p) => !p)}
                  >
                    {showPassword ? <FaEye /> : <FaEyeSlash />}
                  </span>
                </div>
                {touched.password && errors.password && (
                  <span className={classes.errorText}>{errors.password}</span>
                )}
              </div>

              <label className={classes.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={isAgreed}
                  onChange={() => setIsAgreed(!isAgreed)}
                  className={classes.checkbox}
                  required
                />
                <span>
                  I agree to the{" "}
                  <a href="#privacy">UoPeople Privacy Policy</a> and consent to
                  receive university updates.
                </span>
              </label>

              <button
                type="submit"
                disabled={!isAgreed}
                className={classes.submitBtn}
              >
                Create Account
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

export default Registers;
