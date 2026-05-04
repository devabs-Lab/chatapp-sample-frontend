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
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [toperror, setToperr] = useState("");
  const [toperrors, setToperrs] = useState("");
  const [isAgreed, setIsAgreed] = useState(false);

  // const [starter, setstarter] = useState(true);
  const [touched, setTouched] = useState({
    password: false,
    userName: false,
    firstName: false,
    lastName: false,
  });

  // for signup form
  const [formData, setFormData] = useState({
    email: "",
    firstName: "",
    lastName: "",
    userName: "",
    password: "",
  });
  const validateName = (name) => {
    return /^[A-Za-z]{3,}$/.test(name);
  };

  const validateUsername = (username) => {
    const letterOnly = username.replace(/[^A-Za-z]/g, "");
    const specialChars = username.replace(/[A-Za-z]/g, "");

    return (
      letterOnly.length + specialChars.length === username.length &&
      // specialChars.length === 1 &&
      username.length >= 5
    );
  };

  const validatePassword = (password) => {
    const uppercase = /[A-Z]/g;
    const lowercase = /[a-z]/g;
    const number = /[0-9]/g;
    const special = /[@$^&*!#%]/g;

    return (
      (password.match(uppercase) || []).length >= 2 &&
      (password.match(lowercase) || []).length >= 2 &&
      (password.match(number) || []).length >= 1 &&
      (password.match(special) || []).length >= 1 &&
      password.length >= 8
    );
  };

  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData((prev) => ({ ...prev, [name]: value }));
    if (touched[name] && value.trim() !== "") {
      validateField(name, value);
    }
  };
  const handleBlur = (e) => {
    const { name, value } = e.target;
    setTouched((prev) => ({ ...prev, [name]: true }));
    handleChange(e); // validate on blur
    if (value.trim() !== "") {
      validateField(name, value);
    }
  };

  const validateField = (name, value) => {
    const newErrors = { ...errors };
    if (name === "userName") {
      if (!validateUsername(value)) {
        newErrors[name] = "User Name must be at least five and more character";
      } else {
        delete newErrors[name];
      }
    }

    if (name === "password") {
      if (!validatePassword(value)) {
        newErrors[name] =
          "*Password must be at least *2 upper, *2 lower, *1 number, *1 special character";
      } else {
        delete newErrors[name];
      }
    }
    if (name === "firstName") {
      if (!validateName(value)) {
        newErrors[name] = "First Name is not valid.";
      } else {
        delete newErrors[name];
      }
    }
    if (name === "lastName") {
      if (!validateName(value)) {
        newErrors[name] = "Last Name is not valid.";
      } else {
        delete newErrors[name];
      }
    }
    setErrors(newErrors);
  };

  async function handleSubmit(e) {
    e.preventDefault();
    const currentErrors = {};
    setToperr("");
    if (!validateName(formData.firstName)) {
      currentErrors.firstName = "First name must be 3+ letters only";
    }

    if (!validateName(formData.lastName)) {
      currentErrors.lastName = "Last name must be 3+ letters only";
    }

    if (!validateUsername(formData.userName)) {
      currentErrors.userName =
        "**User Name must be at least five and more character";
    }

    if (!validatePassword(formData.password)) {
      currentErrors.password =
        "*Password must be at least *2 upper, *2 lower, *1 number, *1 special)";
    }

    if (Object.keys(currentErrors).length > 0) {
      setErrors(currentErrors);
      return;
    }

    try {
      const { data } = await axiosbase.post("/users/register", {
        username: formData.userName,
        firstname: formData.firstName,
        lastname: formData.lastName,
        email: formData.email,
        password: formData.password,
      });

      navigate("/login");
      setFormData({
        email: "",
        firstName: "",
        lastName: "",
        userName: "",
        password: "",
      });
    } catch (error) {
      console.log(error.response);
      setToperr(error?.response?.data?.msg);
      showErrorAlert("SignUp Failed", error?.response?.data?.msg);
    }
  }
  // for signin form
  const [signData, setsignData] = useState({
    email: "",
    password: "",
  });
  const handleChangefors = (e) => {
    const { name, value } = e.target;
    setsignData({
      ...signData,
      [name]: value,
    });
  };

  async function handleSubmitfors(e) {
    e.preventDefault();
    const currentErrors = {};
    setToperrs("");
    if ((Object.keys(currentErrors).length = 0)) {
      setErrors(currentErrors);
      return;
    }

    try {
      const res = await axiosbase.post("/users/login", {
        email: signData.email,
        password: signData.password,
      });
      // console.log(res);
      if (res.status === 200) {
        showSuccessAlert("Login Successful", "Click OK to continue", () => {
          setuser(res?.data);
          sessionStorage.setItem("token", res?.data?.token);
          navigate("/chat");
        });
      }
    } catch (error) {
      console.log(error.response);

      setToperrs(error?.response?.data?.msg);
    }
  }

  return (
    <>
      <main className={classes.main_content}>
        <div className={classes.content_wrapper}>
          {location.pathname === "/login" && (
            <div className={classes.form_section}>
              <div className={classes.form_container}>
                <h2
                  className={classes.form_titlee}
                  style={{ paddingBottom: "50px", paddingTop: "20px" }}
                >
                  Login to your account
                </h2>

                <form
                  onSubmit={handleSubmitfors}
                  className={classes.login_form}
                >
                  <input
                    type="email"
                    name="email"
                    placeholder="Your Email"
                    value={signData.email}
                    onChange={handleChangefors}
                    className={classes.form_input}
                    required
                  />

                  <div
                    className={classes.password_container}
                    style={{ paddingBottom: "10px" }}
                  >
                    <input
                      type={showPassword ? "text" : "password"}
                      name="password"
                      placeholder="Your Password"
                      value={signData.password}
                      onChange={handleChangefors}
                      className={classes.form_input}
                      required
                    />
                    <span
                      className={classes.eye_icon}
                      onClick={() => setShowPassword((prev) => !prev)}
                    >
                      {showPassword ? <FaEye /> : <FaEyeSlash />}
                    </span>
                  </div>
                  {toperrors && (
                    <div
                      className={classes.errorss}
                      style={{ fontSize: "14px", fontWeight: "400" }}
                    >
                      {toperrors}
                    </div>
                  )}
                  <Link
                    to={""}
                    className={classes.form_sub}
                    style={{ color: "#ff8c42", padding: "5px" }}
                  >
                    forgot password ?
                  </Link>

                  <button type="submit" className={classes.submit_btn}>
                    submit
                  </button>

                  <p className={classes.form_subtitle}>
                    Don't have an account?{" "}
                    <Link to={"/signup"} className={classes.form_subb}>
                      Create a new account
                    </Link>
                  </p>
                </form>
              </div>
            </div>
          )}

          {location.pathname === "/signup" && (
            <div className={classes.form_section}>
              <div className={classes.form_container}>
                <h2 className={classes.form_title}>Join the network</h2>
                <p className={classes.form_subtitle}>
                  Already have an account?{" "}
                  <Link to={"/login"} className={classes.form_sub}>
                    Sign in
                  </Link>
                </p>

                <form onSubmit={handleSubmit} className={classes.signup_form}>
                  {toperror && (
                    <div
                      className={classes.errorss}
                      style={{ fontSize: "14px", fontWeight: "400" }}
                    >
                      {toperror}
                    </div>
                  )}

                  <input
                    type="email"
                    name="email"
                    placeholder="Email"
                    value={formData.email}
                    onChange={handleChange}
                    className={classes.form_input}
                    required
                  />

                  <div className={classes.name_row}>
                    <input
                      type="text"
                      name="firstName"
                      placeholder="First Name"
                      value={formData.firstName}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      className={`${classes["form_input"]} ${classes["half_width"]}`}
                      required
                    />

                    <input
                      type="text"
                      name="lastName"
                      placeholder="Last Name"
                      value={formData.lastName}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      className={`${classes["form_input"]} ${classes["half_width"]}`}
                      required
                    />
                  </div>
                  <div className={classes.name_roww}>
                    {touched.firstName && errors.firstName && (
                      <div className={classes.errors}>{errors.firstName}</div>
                    )}
                    {touched.lastName && errors.lastName && (
                      <div className={classes.errors}>{errors.lastName}</div>
                    )}
                  </div>

                  <input
                    type="text"
                    name="userName"
                    placeholder="User Name"
                    value={formData.userName}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    className={`${classes["form_input"]} ${classes["half_width"]}`}
                    required
                  />
                  {touched.userName && errors.userName && (
                    <div className={classes.errors}>{errors.userName}</div>
                  )}
                  <div
                    className={`${classes.password_container} ${
                      touched.password && errors.password
                        ? classes.password_error
                        : ""
                    }`}
                  >
                    <input
                      type={showPassword ? "text" : "password"}
                      name="password"
                      placeholder="Password"
                      value={formData.password}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      className={`${classes["form_input"]} ${classes["half_width"]}`}
                      required
                    />
                    <span
                      className={classes.eye_icon}
                      onClick={() => setShowPassword((prev) => !prev)}
                    >
                      {showPassword ? <FaEye /> : <FaEyeSlash />}
                    </span>
                  </div>

                  {touched.password && errors.password && (
                    <div className={classes.errors}>{errors.password}</div>
                  )}

                  <label className={classes.checkbox_label}>
                    <input
                      type="checkbox"
                      checked={isAgreed}
                      onChange={() => setIsAgreed(!isAgreed)}
                      className={classes.checkbox}
                      required
                    />
                    <span className={classes.terms_text}>
                      I agree to the{" "}
                      <a href="#privacy">UoPeople Privacy Policy</a> and give my
                      consent to recieve university updates via email, phone,
                      and text.
                    </span>
                  </label>

                  <button
                    type="submit"
                    disabled={!isAgreed}
                    className={`${classes.submit_btn} ${
                      !isAgreed ? classes.disabled_btn : ""
                    }`}
                  >
                    Agree and Join
                  </button>

                  <p className={classes.signin_link}>
                    <Link to={"/login"} className={classes.form_sub}>
                      Already have an account?
                    </Link>
                  </p>
                </form>
              </div>
            </div>
          )}

          <div className={classes.info_section}>
            <div className={classes.info_content}>
              <span className={classes.about_label}>About</span>
              <h3 className={classes.info_title}>UoPeople Discussion Forum</h3>
              <p className={classes.info_text} style={{ marginBottom: "10px" }}>
                Welcome to the official discussion space made just for us
                <strong style={{ fontSize: "1rem" }}>
                  {" "}
                  UoPeople students from all around the world
                </strong>
                . Whether you’re tackling your first course or wrapping up your
                degree, this forum is here to make things easier, more
                connected, and way more supportive.
              </p>
              <p className={classes.info_text} style={{ marginBottom: "10px" }}>
                Got questions about assignments? Stuck on a topic? Want to hear
                how others are managing their study schedule? Or just need to
                connect with fellow students who get what you’re going through?
                You’re in the right place.{" "}
              </p>
              <p className={classes.info_text} style={{ marginBottom: "10px" }}>
                No matter your major — Business, Computer Science, Health
                Science, Psychology, or anything else — we’re all on this
                journey together. Let’s grow, learn, and help each other out.
              </p>
              <p className={classes.info_text}>
                Jump in, start a convo, and don’t be shy — this community is
                here for you.
              </p>
              <button className={classes.how_it_works_btn}>HOW IT WORKS</button>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}

export default Registers;
