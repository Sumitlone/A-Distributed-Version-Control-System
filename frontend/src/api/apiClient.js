import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:3002",

  timeout: 15000,
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error),
);

api.interceptors.response.use(
  (response) => response,

  (error) => {
    const status = error.response?.status;

    const pathname = window.location.pathname;

    if (status === 401 && pathname !== "/auth" && pathname !== "/signup") {
      localStorage.removeItem("token");

      localStorage.removeItem("userId");

      sessionStorage.setItem(
        "authMessage",
        "Your session has expired. Please log in again.",
      );

      window.location.replace("/auth");
    }

    return Promise.reject(error);
  },
);

export default api;
