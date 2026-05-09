import axios from "axios";

const axiosbase = axios.create({
  baseURL: import.meta.env.VITE_API_URL + "/api", // Use the environment variable for the base URL for deployment purpose
  // baseURL: "http://localhost:5500/api", // this one for localhost
});

// Attach Authorization header automatically if token exists
axiosbase.interceptors.request.use((config) => {
  const token = sessionStorage.getItem("token");
  // console.log("Axios request token:", token);
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

axiosbase.interceptors.response.use(
  (response) => {
    // If it's a blob, just return it untouched
    if (response.config.responseType === "blob") {
      return response;
    }
    return response;
  },
  (error) => Promise.reject(error),
);

export default axiosbase;
